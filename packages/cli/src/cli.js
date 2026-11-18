#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { readFileSync } from 'node:fs'
import { CliError } from './errors.js'
import { terminalLogin, webLogin } from './login.js'
import { getPage, pageText, searchPages, writePage } from './pages.js'
import {
  activeProfile,
  apiEndpoint,
  listProfiles,
  profileName,
  readProfile,
  selectProfile,
} from './profiles.js'
import { wikiError, wikiSession } from './wiki.js'

const help = `Usage: ipe [--profile NAME] [--json] <command>

  login [--api URL] [--login-name USER@BOT] [--web]
  profile list
  profile use NAME
  whoami
  page search QUERY [--limit N]
  page get TITLE
  page edit TITLE --file PATH --base-revid ID --summary TEXT
  page create TITLE --file PATH --summary TEXT

Use --file - to read page content from stdin. Use --json to get metadata with page source.
On login, --web prints a local URL for the user. Omit it for hidden terminal input.
`

const options = {
  profile: { type: 'string' },
  json: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
  api: { type: 'string' },
  'login-name': { type: 'string' },
  web: { type: 'boolean' },
  limit: { type: 'string' },
  file: { type: 'string' },
  'base-revid': { type: 'string' },
  summary: { type: 'string' },
}

const commands = new Map([
  ['login', { positionals: 1, flags: ['profile', 'api', 'login-name', 'web'] }],
  ['profile list', { positionals: 2, flags: [] }],
  ['profile use', { positionals: 3, flags: [] }],
  ['whoami', { positionals: 1, flags: ['profile'] }],
  ['page search', { positionals: 3, flags: ['profile', 'limit'] }],
  ['page get', { positionals: 3, flags: ['profile'] }],
  ['page edit', { positionals: 3, flags: ['profile', 'file', 'base-revid', 'summary'] }],
  ['page create', { positionals: 3, flags: ['profile', 'file', 'summary'] }],
])

function integer(value, flag, max = Number.MAX_SAFE_INTEGER) {
  if (!/^[1-9]\d*$/.test(value ?? '') || Number(value) > max) {
    throw new CliError('usage_error', `${flag} requires an integer from 1 to ${max}.`)
  }
  return Number(value)
}

function output(data, json, human) {
  process.stdout.write(json || human === undefined ? `${JSON.stringify(data)}\n` : human)
}

async function run(command, values, operand) {
  if (command === 'profile list') {
    const data = await listProfiles()
    const lines = data.profiles.map(
      ({ name, username, api }) =>
        `${name === data.active ? '*' : ' '} ${name}\t${username}\t${api}`
    )
    output(data, values.json, lines.length ? `${lines.join('\n')}\n` : 'No profiles configured.\n')
    return
  }
  if (command === 'profile use') {
    const profile = await selectProfile(operand)
    output(profile, values.json, `Default profile: ${profile.name}\n`)
    return
  }

  const name = values.profile ?? (await activeProfile())
  if (name === undefined) {
    throw new CliError(
      'profile_required',
      'Specify --profile NAME or set the default with ipe profile use NAME.'
    )
  }
  profileName(name)
  const profile = await readProfile(name)

  if (command === 'login') {
    const api = values.api === undefined ? profile?.api : apiEndpoint(values.api)
    if (profile && api !== profile.api) {
      throw new CliError(
        'profile_mismatch',
        'This profile is bound to another API URL. Use another profile name.'
      )
    }
    const defaults = { api, loginName: values['login-name'] ?? profile?.loginName }
    const saved = values.web
      ? await webLogin(name, defaults, profile, (url) =>
          process.stderr.write(
            values.json
              ? `${JSON.stringify({ event: 'login_url', url })}\n`
              : `Open in your browser: ${url}\n`
          )
        )
      : await terminalLogin(name, defaults, profile)
    output(saved, values.json, `Saved profile ${name} as ${saved.username}.\n`)
    return
  }

  const isWriting = command === 'page edit' || command === 'page create'
  if (
    command.startsWith('page ') &&
    (!operand.trim() || (command !== 'page search' && operand.includes('|')))
  ) {
    throw new CliError('usage_error', 'Specify one non-empty page title or search query.')
  }
  if (isWriting && (!values.file || !values.summary?.trim())) {
    throw new CliError('usage_error', 'Page edits require --file PATH and --summary TEXT.')
  }
  const baseRevision =
    command === 'page edit' ? integer(values['base-revid'], '--base-revid') : undefined
  const limit = command === 'page search' ? integer(values.limit ?? '10', '--limit', 50) : undefined
  if (!profile) {
    throw new CliError(
      'profile_not_found',
      `Profile "${name}" does not exist. Configure it with ipe login --profile ${name} --api URL --web.`
    )
  }
  const text = isWriting ? await pageText(values.file) : undefined
  try {
    const session = await wikiSession(profile)
    switch (command) {
      case 'whoami': {
        const identity = {
          profile: name,
          api: profile.api,
          username: session.username,
          userId: session.userId,
        }
        output(identity, values.json, `${identity.username} (${name}) on ${identity.api}\n`)
        break
      }
      case 'page search': {
        const results = await searchPages(session, operand, limit)
        const lines = results.map(({ title }) => title)
        output(results, values.json, lines.length ? `${lines.join('\n')}\n` : '')
        break
      }
      case 'page get': {
        const page = await getPage(session, operand)
        output(page, values.json, page.text)
        break
      }
      case 'page edit':
      case 'page create': {
        const edit = await writePage(session, {
          title: operand,
          text,
          summary: values.summary,
          baseRevision,
        })
        output(edit, values.json, `${edit.title} · revision ${edit.revisionId}\n`)
        break
      }
    }
  } catch (error) {
    throw wikiError(error, profile)
  }
}

const argv = process.argv.slice(2)
let json = argv.slice(0, argv.includes('--') ? argv.indexOf('--') : undefined).includes('--json')
try {
  let parsed
  try {
    parsed = parseArgs({ args: argv, options, allowPositionals: true })
  } catch {
    throw new CliError('usage_error', 'Invalid command options. See ipe --help.')
  }

  const { values, positionals } = parsed
  json = values.json
  const [group, action] = positionals
  const command = ['profile', 'page'].includes(group) ? `${group} ${action}` : group
  if (values.version) {
    const { version } = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8')
    )
    output({ version }, json, `${version}\n`)
  } else if (values.help || !group) {
    output({ help }, json, help)
  } else {
    const definition = commands.get(command)
    if (
      !definition ||
      definition.positionals !== positionals.length ||
      Object.keys(values).some((flag) => flag !== 'json' && !definition.flags.includes(flag))
    ) {
      throw new CliError('usage_error', 'Invalid command or arguments. See ipe --help.')
    }
    await run(command, values, positionals.at(-1))
  }
} catch (error) {
  const { code, message, details } =
    error instanceof CliError
      ? error
      : { code: 'unexpected_error', message: 'IPE could not complete the command.' }
  process.stderr.write(
    json ? `${JSON.stringify({ error: { code, message, ...details } })}\n` : `ipe: ${message}\n`
  )
  process.exitCode = 1
}
