#!/usr/bin/env node
import { parseArgs, type ParseArgsOptionsConfig } from 'node:util'
import { readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { actionRequest, prepareActionRequest, type ActionRequest } from './action-api.js'
import { CliError } from './errors.js'
import { onCredentialWait } from './keyring.js'
import { terminalLogin, webLogin } from './login.js'
import { movePage, prepareMove, prepareUpload, uploadFile } from './maintenance.js'
import {
  diffPage,
  getPage,
  pageText,
  previewDocument,
  previewPage,
  searchPages,
  writePage,
} from './pages.js'
import {
  activeProfile,
  apiEndpoint,
  listProfiles,
  profileName,
  readProfile,
  selectProfile,
} from './profiles.js'
import type { Profile, Session, Values } from './types.js'
import { wikiIdentity, withAnonymousSession, withWikiSession } from './wiki.js'

const help = `Usage: ipe [--profile NAME] [--json] <command>

  skill
  login [--api URL] [--login-name USER@BOT] [--web]
  profile list
  profile use NAME
  whoami
  page search QUERY [--limit N]
  page get TITLE [--section N] [--out PATH]
  page diff TITLE --file PATH [--section N] [--base-revid ID]
  page preview TITLE --file PATH [--html PATH]
  page edit TITLE --file PATH --base-revid ID --summary TEXT [--section N]
  page create TITLE --file PATH --summary TEXT
  page move FROM TO --reason TEXT [--move-talk] [--no-redirect]
  file upload PATH [--filename NAME] [--summary TEXT] [--description-file PATH] [--ignore-warnings]
  action-api [--method GET|POST] [--query KEY=VALUE]... [--form KEY=VALUE | --body PATH] [--token csrf]

skill prints the guide for agents that use this CLI.
page search, get, diff, preview, and action-api without --token accept --api URL in place of
a profile and run anonymously.
--section N selects section N of the page; 0 is the lead.
Use --file - to read page content from stdin. Use --json to get metadata with page source.
Use --form KEY=@PATH to attach a file. --body reads a JSON object from a file or stdin (-).
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
  out: { type: 'string' },
  html: { type: 'string' },
  section: { type: 'string' },
  'base-revid': { type: 'string' },
  summary: { type: 'string' },
  method: { type: 'string' },
  query: { type: 'string', multiple: true },
  form: { type: 'string', multiple: true },
  body: { type: 'string' },
  token: { type: 'string' },
  filename: { type: 'string' },
  'description-file': { type: 'string' },
  'ignore-warnings': { type: 'boolean' },
  reason: { type: 'string' },
  'move-talk': { type: 'boolean' },
  'no-redirect': { type: 'boolean' },
} satisfies ParseArgsOptionsConfig

type Flag = keyof Values

const commands = new Map<string, { positionals: number; flags: Flag[] }>([
  ['skill', { positionals: 1, flags: [] }],
  ['login', { positionals: 1, flags: ['profile', 'api', 'login-name', 'web'] }],
  ['profile list', { positionals: 2, flags: [] }],
  ['profile use', { positionals: 3, flags: [] }],
  ['whoami', { positionals: 1, flags: ['profile'] }],
  ['page search', { positionals: 3, flags: ['profile', 'api', 'limit'] }],
  ['page get', { positionals: 3, flags: ['profile', 'api', 'section', 'out'] }],
  ['page diff', { positionals: 3, flags: ['profile', 'api', 'file', 'section', 'base-revid'] }],
  ['page preview', { positionals: 3, flags: ['profile', 'api', 'file', 'html'] }],
  ['page edit', { positionals: 3, flags: ['profile', 'file', 'base-revid', 'summary', 'section'] }],
  ['page create', { positionals: 3, flags: ['profile', 'file', 'summary'] }],
  ['page move', { positionals: 4, flags: ['profile', 'reason', 'move-talk', 'no-redirect'] }],
  [
    'file upload',
    {
      positionals: 3,
      flags: ['profile', 'filename', 'summary', 'description-file', 'ignore-warnings'],
    },
  ],
  [
    'action-api',
    { positionals: 1, flags: ['profile', 'api', 'method', 'query', 'form', 'body', 'token'] },
  ],
])

/** Commands that only read, and may therefore run anonymously with --api. */
const readCommands = new Set(['page search', 'page get', 'page diff', 'page preview', 'action-api'])

function integer(value: string | undefined, flag: string, min = 1, max = Number.MAX_SAFE_INTEGER) {
  if (!/^(0|[1-9]\d*)$/.test(value ?? '') || Number(value) < min || Number(value) > max) {
    throw new CliError('usage_error', `${flag} requires an integer from ${min} to ${max}.`)
  }
  return Number(value)
}

function output(data: unknown, json: boolean | undefined, human?: string) {
  process.stdout.write(json || human === undefined ? `${JSON.stringify(data)}\n` : human)
}

function bundledSkill() {
  return readFileSync(new URL('../skill/SKILL.md', import.meta.url), 'utf8')
}

/** Validated inputs, read before any network request so usage errors cost nothing. */
interface Prepared {
  title: string
  destination?: string
  text?: string
  section?: number
  baseRevision?: number
  limit?: number
  request?: ActionRequest
  form?: FormData
}

async function prepare(
  command: string,
  values: Values,
  operand = '',
  destination?: string
): Promise<Prepared> {
  if (
    command.startsWith('page ') &&
    command !== 'page move' &&
    (!operand.trim() || (command !== 'page search' && operand.includes('|')))
  ) {
    throw new CliError('usage_error', 'Specify one non-empty page title or search query.')
  }
  const needsFile = ['page edit', 'page create', 'page diff', 'page preview'].includes(command)
  if (needsFile && !values.file) {
    throw new CliError('usage_error', `${command} requires --file PATH.`)
  }
  if ((command === 'page edit' || command === 'page create') && !values.summary?.trim()) {
    throw new CliError('usage_error', 'Page edits require --summary TEXT.')
  }
  const prepared: Prepared = { title: operand, destination }
  if (values.section !== undefined) prepared.section = integer(values.section, '--section', 0)
  if (command === 'page edit' || values['base-revid'] !== undefined) {
    prepared.baseRevision = integer(values['base-revid'], '--base-revid')
  }
  if (command === 'page search') prepared.limit = integer(values.limit ?? '10', '--limit', 1, 50)
  if (needsFile) prepared.text = await pageText(values.file!)
  if (command === 'action-api') prepared.request = await prepareActionRequest(values)
  if (command === 'file upload') prepared.form = await prepareUpload(operand, values)
  if (command === 'page move') prepared.form = prepareMove(operand, destination ?? '', values)
  return prepared
}

async function execute(
  command: string,
  session: Session,
  values: Values,
  input: Prepared,
  profile?: Profile
) {
  const { json } = values
  switch (command) {
    case 'whoami': {
      const identity = {
        profile: profile!.name,
        api: profile!.api,
        ...(await wikiIdentity(session, profile!)),
      }
      output(identity, json, `${identity.username} (${profile!.name}) on ${identity.api}\n`)
      return
    }
    case 'page search': {
      const results = await searchPages(session, input.title, input.limit!)
      const lines = results.map(({ title }) => title)
      output(results, json, lines.length ? `${lines.join('\n')}\n` : '')
      return
    }
    case 'page get': {
      const page = await getPage(session, input)
      if (values.out === undefined) {
        output(page, json, page.text)
        return
      }
      const file = resolve(values.out)
      try {
        await writeFile(file, page.text)
      } catch {
        throw new CliError('output_error', 'Could not write the page source to --out.')
      }
      const { text, ...metadata } = page
      const section = page.section === undefined ? '' : ` §${page.section}`
      output(
        { ...metadata, file },
        json,
        `${page.title}${section} · revision ${page.revisionId} → ${file}\n`
      )
      return
    }
    case 'page diff': {
      const page = await getPage(session, { ...input, revisionId: input.baseRevision })
      const result = diffPage(page, input.text!, values.file!)
      output(result, json, result.diff)
      return
    }
    case 'page preview': {
      const preview = await previewPage(session, input.title, input.text!)
      const { html, ...summary } = preview
      let file: string | undefined
      if (values.html !== undefined) {
        file = resolve(values.html)
        try {
          await writeFile(file, previewDocument(preview, session.wiki.baseURL))
        } catch {
          throw new CliError('output_error', 'Could not write the preview to --html.')
        }
      }
      const list = (label: string, items: string[]) =>
        items.length ? `${label}:\n${items.map((item) => `  ${item}`).join('\n')}\n` : ''
      const human =
        list('Warnings', summary.warnings) +
        list(
          'Categories',
          summary.categories.map(
            ({ title, hidden, missing }) =>
              `${title}${hidden ? ' (hidden)' : ''}${missing ? ' (no page)' : ''}`
          )
        ) +
        list('Missing templates', summary.missingTemplates) +
        list('Red links', summary.redLinks) +
        (file ? `Rendered page: ${file}\n` : '')
      output({ ...summary, ...(file ? { file } : {}) }, json, human || 'No issues found.\n')
      return
    }
    case 'action-api':
      output(await actionRequest(session, input.request!), json)
      return
    case 'file upload': {
      const result = await uploadFile(session, input.form!)
      output(result, json, `Uploaded File:${result.filename}\n`)
      return
    }
    case 'page move': {
      const result = await movePage(session, input.form!)
      const talk = result.talkto ? `Talk page moved to ${result.talkto}\n` : ''
      const warning = result['talkmove-error-info'] ?? result['talkmove-error-code']
      const notices = warning ? `Talk page: ${warning}\n` : ''
      const warnings = result.warnings ? `Warnings: ${JSON.stringify(result.warnings)}\n` : ''
      output(result, json, `Moved ${result.from} → ${result.to}\n${talk}${notices}${warnings}`)
      return
    }
    case 'page edit':
    case 'page create': {
      const edit = await writePage(session, {
        title: input.title,
        text: input.text!,
        summary: values.summary!,
        baseRevision: command === 'page edit' ? input.baseRevision : undefined,
        section: input.section,
      })
      output(edit, json, `${edit.title} · revision ${edit.revisionId}\n`)
      return
    }
  }
}

async function run(command: string, values: Values, operand?: string, destination?: string) {
  if (command === 'skill') {
    const skill = bundledSkill()
    output({ skill }, values.json, skill)
    return
  }
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
    const profile = await selectProfile(operand!)
    output(profile, values.json, `Default profile: ${profile.name}\n`)
    return
  }

  if (command !== 'login' && values.api !== undefined) {
    if (!readCommands.has(command) || values.profile !== undefined || values.token) {
      throw new CliError(
        'usage_error',
        '--api runs read commands anonymously and cannot be combined with --profile or --token.'
      )
    }
    const api = apiEndpoint(values.api)
    const input = await prepare(command, values, operand, destination)
    await withAnonymousSession(api, (session) => execute(command, session, values, input))
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

  const input = await prepare(command, values, operand, destination)
  if (!profile) {
    throw new CliError(
      'profile_not_found',
      `Profile "${name}" does not exist. Configure it with ipe login --profile ${name} --api URL --web.`
    )
  }
  await withWikiSession(profile, (session) => execute(command, session, values, input, profile))
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

  const values = parsed.values as Values
  const { positionals } = parsed
  json = values.json ?? false
  onCredentialWait(() =>
    process.stderr.write(
      json
        ? `${JSON.stringify({ event: 'credential_prompt' })}\n`
        : 'ipe: Waiting for the system credential store. Approve the access prompt on this computer if one is open.\n'
    )
  )
  const [group, action] = positionals
  const command = ['profile', 'page', 'file'].includes(group) ? `${group} ${action}` : group
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
      Object.keys(values).some(
        (flag) => flag !== 'json' && !definition.flags.includes(flag as Flag)
      )
    ) {
      throw new CliError('usage_error', 'Invalid command or arguments. See ipe --help.')
    }
    await run(command, values, positionals[2], positionals[3])
  }
} catch (error) {
  const { code, message, details } =
    error instanceof CliError
      ? error
      : { code: 'unexpected_error', message: 'IPE could not complete the command.', details: {} }
  process.stderr.write(
    json ? `${JSON.stringify({ error: { code, message, ...details } })}\n` : `ipe: ${message}\n`
  )
  process.exitCode = 1
}
