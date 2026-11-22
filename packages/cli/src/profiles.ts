import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, rename, link, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { gzipSync, gunzipSync } from 'node:zlib'
import { CliError } from './errors.js'
import { keyring, type KeyringRequest } from './keyring.js'
import type { Profile } from './types.js'

const configDir = resolve(process.env.IPE_CONFIG_DIR || join(homedir(), '.config', 'inpageedit'))
const profileDir = join(configDir, 'profiles')
const activeFile = join(configDir, 'active')
const credentialDir = join(configDir, 'credentials')

/**
 * Where passwords and session cookies live. `file` is for machines with no
 * system credential store (a headless Linux VM): plain files any process of
 * this user can read. Opt-in only, never a fallback: a desktop whose store
 * fails once must not start writing passwords to disk unasked.
 */
function credentialStore(): 'system' | 'file' {
  const value = process.env.IPE_CREDENTIAL_STORE || 'system'
  if (value === 'system' || value === 'file') return value
  throw new CliError('invalid_credential_store', 'Set IPE_CREDENTIAL_STORE to "system" or "file".')
}

export function profileName(name: string | undefined): string {
  // Case-insensitive filesystems and Windows device names must behave consistently.
  if (
    name === undefined ||
    !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(name) ||
    /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/.test(name)
  ) {
    throw new CliError(
      'invalid_profile',
      'Use a profile name with lowercase letters, numbers, hyphens, or underscores.'
    )
  }
  return name
}

export function apiEndpoint(value: string): string {
  const url = URL.parse(value)
  if (
    !url ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname)))
  ) {
    throw new CliError(
      'invalid_api',
      'Enter the HTTPS URL of the Wiki Action API, usually ending in api.php.'
    )
  }
  return url.href
}

async function readOptional(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

async function atomicWrite(path: string, contents: string, createOnly = false) {
  const temp = `${path}.${randomUUID()}.tmp`
  await writeFile(temp, contents, { mode: 0o600, flag: 'wx' })
  try {
    if (createOnly) await link(temp, path)
    else await rename(temp, path)
  } finally {
    await unlink(temp).catch(() => {})
  }
}

export async function activeProfile(): Promise<string | undefined> {
  const name = await readOptional(activeFile)
  return name === undefined ? undefined : profileName(name.trim())
}

export async function readProfile(name: string): Promise<Profile | undefined> {
  const input = await readOptional(join(profileDir, `${profileName(name)}.json`))
  if (input === undefined) return undefined
  const { api, loginName, username, userId } = JSON.parse(input)
  if (
    typeof api !== 'string' ||
    typeof loginName !== 'string' ||
    typeof username !== 'string' ||
    !Number.isSafeInteger(userId) ||
    userId <= 0
  ) {
    throw new CliError('invalid_profile', `Profile "${name}" is invalid.`)
  }
  return { name, api: apiEndpoint(api), loginName, username, userId }
}

export async function selectProfile(name: string): Promise<Profile> {
  const selected = await readProfile(name)
  if (!selected) throw new CliError('profile_not_found', `Profile "${name}" does not exist.`)
  await atomicWrite(activeFile, `${name}\n`)
  return selected
}

export async function listProfiles() {
  const active = await activeProfile()
  const files = await readdir(profileDir).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return [] as string[]
    throw error
  })
  const profiles = await Promise.all(
    files
      .filter((file) => file.endsWith('.json'))
      .sort()
      .map((file) => readProfile(file.slice(0, -5)))
  )
  return {
    active: active ?? null,
    profiles: profiles.filter((profile): profile is Profile => profile !== undefined),
  }
}

function keyringAccount(profile: Profile): string {
  return createHash('sha256')
    .update(
      JSON.stringify([configDir, profile.name, profile.api, profile.loginName, profile.userId])
    )
    .digest('hex')
}

async function credential(
  op: KeyringRequest['op'],
  profile: Profile,
  service: string,
  value?: KeyringRequest['value']
): Promise<unknown> {
  if (credentialStore() === 'file') return fileCredential(op, service, keyringAccount(profile), value)
  try {
    return await keyring({ op, service, account: keyringAccount(profile), value })
  } catch (error) {
    if (error instanceof CliError) throw error
    throw new CliError(
      'credential_store_error',
      op.startsWith('get')
        ? 'Could not read from the system credential store.'
        : 'Could not save to the system credential store.'
    )
  }
}

/** The file store: one base64 file per (service, account), readable only by this user. */
async function fileCredential(
  op: KeyringRequest['op'],
  service: string,
  account: string,
  value?: KeyringRequest['value']
): Promise<unknown> {
  const path = join(
    credentialDir,
    createHash('sha256').update(JSON.stringify([service, account])).digest('hex')
  )
  if (op === 'getPassword' || op === 'getSecret') {
    const stored = await readOptional(path)
    if (stored === undefined) return null
    const bytes = Buffer.from(stored.trim(), 'base64')
    return op === 'getPassword' ? bytes.toString('utf8') : [...bytes]
  }
  await mkdir(credentialDir, { recursive: true, mode: 0o700 })
  const bytes = typeof value === 'string' ? Buffer.from(value, 'utf8') : Buffer.from(value ?? [])
  await atomicWrite(path, `${bytes.toString('base64')}\n`)
}

const PASSWORD = 'InPageEdit CLI'
const SESSION = 'InPageEdit CLI Session'

export async function savedPassword(profile: Profile): Promise<string | null> {
  return (await credential('getPassword', profile, PASSWORD)) as string | null
}

export async function savedSession(profile: Profile): Promise<unknown> {
  try {
    const bytes = (await credential('getSecret', profile, SESSION)) as number[] | null
    if (bytes) return JSON.parse(gunzipSync(Buffer.from(bytes)).toString('utf8'))
  } catch (error) {
    // An unreadable cache is equivalent to a cache miss, but a pending prompt is not.
    if (error instanceof CliError && error.code === 'credential_store_timeout') throw error
  }
}

export async function saveSession(profile: Profile, session: unknown) {
  try {
    await credential('setSecret', profile, SESSION, gzipSync(JSON.stringify(session)))
  } catch (error) {
    // A credential store can reject large entries. The verified session is still usable.
    if (error instanceof CliError && error.code === 'credential_store_timeout') throw error
  }
}

export async function saveProfile(profile: Profile, password: string, existing?: Profile) {
  await mkdir(profileDir, { recursive: true, mode: 0o700 })
  await credential('setPassword', profile, PASSWORD, password)

  const { name, ...metadata } = profile
  try {
    await atomicWrite(
      join(profileDir, `${name}.json`),
      `${JSON.stringify(metadata, null, 2)}\n`,
      !existing
    )
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new CliError(
        'profile_exists',
        `Profile "${name}" was already created. Run the login command again.`
      )
    }
    throw error
  }
}
