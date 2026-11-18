import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, rename, link, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { gzipSync, gunzipSync } from 'node:zlib'
import { CliError } from './errors.js'
import { keyring } from './keyring.js'

const configDir = resolve(process.env.IPE_CONFIG_DIR || join(homedir(), '.config', 'inpageedit'))
const profileDir = join(configDir, 'profiles')
const activeFile = join(configDir, 'active')

export function profileName(name) {
  // Case-insensitive filesystems and Windows device names must behave consistently.
  if (
    !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(name ?? '') ||
    /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/.test(name)
  ) {
    throw new CliError(
      'invalid_profile',
      'Use a profile name with lowercase letters, numbers, hyphens, or underscores.'
    )
  }
  return name
}

export function apiEndpoint(value) {
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

async function readOptional(path) {
  try {
    return await readFile(path, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return undefined
    throw error
  }
}

async function atomicWrite(path, contents, createOnly = false) {
  const temp = `${path}.${randomUUID()}.tmp`
  await writeFile(temp, contents, { mode: 0o600, flag: 'wx' })
  try {
    if (createOnly) await link(temp, path)
    else await rename(temp, path)
  } finally {
    await unlink(temp).catch(() => {})
  }
}

export async function activeProfile() {
  const name = await readOptional(activeFile)
  return name === undefined ? undefined : profileName(name.trim())
}

export async function readProfile(name) {
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

export async function selectProfile(name) {
  const selected = await readProfile(name)
  if (!selected) throw new CliError('profile_not_found', `Profile "${name}" does not exist.`)
  await atomicWrite(activeFile, `${name}\n`)
  return selected
}

export async function listProfiles() {
  const active = await activeProfile()
  const files = await readdir(profileDir).catch((error) => {
    if (error.code === 'ENOENT') return []
    throw error
  })
  const profiles = await Promise.all(
    files
      .filter((file) => file.endsWith('.json'))
      .sort()
      .map((file) => readProfile(file.slice(0, -5)))
  )
  return { active: active ?? null, profiles: profiles.filter(Boolean) }
}

function keyringAccount(profile) {
  return createHash('sha256')
    .update(JSON.stringify([configDir, profile.name, profile.api, profile.loginName, profile.userId]))
    .digest('hex')
}

async function credential(op, profile, service, value) {
  try {
    return await keyring(op, service, keyringAccount(profile), value)
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

const PASSWORD = 'InPageEdit CLI'
const SESSION = 'InPageEdit CLI Session'

export async function savedPassword(profile) {
  return credential('getPassword', profile, PASSWORD)
}

export async function savedSession(profile) {
  try {
    const bytes = await credential('getSecret', profile, SESSION)
    if (bytes) return JSON.parse(gunzipSync(Buffer.from(bytes)).toString('utf8'))
  } catch (error) {
    // An unreadable cache is equivalent to a cache miss, but a pending prompt is not.
    if (error.code === 'credential_store_timeout') throw error
  }
}

export async function saveSession(profile, session) {
  try {
    await credential('setSecret', profile, SESSION, gzipSync(JSON.stringify(session)))
  } catch (error) {
    // A credential store can reject large entries. The verified session is still usable.
    if (error.code === 'credential_store_timeout') throw error
  }
}

export async function saveProfile(profile, password, existing) {
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
    if (error.code === 'EEXIST') {
      throw new CliError(
        'profile_exists',
        `Profile "${name}" was already created. Run the login command again.`
      )
    }
    throw error
  }
}
