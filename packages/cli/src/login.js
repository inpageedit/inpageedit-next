import { randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { createInterface } from 'node:readline/promises'
import { Writable } from 'node:stream'
import { CliError } from './errors.js'
import { loginPage, pageLanguage } from './login-page.js'
import { configureProfile } from './wiki.js'

export async function terminalLogin(name, defaults, existing) {
  if (!process.stdin.isTTY || !process.stderr.isTTY) {
    throw new CliError('terminal_required', 'Run login in a user terminal or use --web.')
  }

  let mute = false
  const output = new Writable({
    write(chunk, encoding, done) {
      if (mute) done()
      else process.stderr.write(chunk, encoding, done)
    },
  })
  output.columns = process.stderr.columns
  const terminal = createInterface({ input: process.stdin, output, terminal: true, historySize: 0 })
  const stop = new AbortController()
  terminal.on('SIGINT', () => stop.abort())
  terminal.on('close', () => stop.abort())
  const question = (prompt) => terminal.question(prompt, { signal: stop.signal })
  try {
    const api = defaults.api || (await question('Wiki Action API URL: '))
    const loginName = defaults.loginName || (await question('Bot Password login name (User@Bot): '))
    process.stderr.write(`Profile ${name} · ${api} · ${loginName}\nBot Password: `)
    mute = true
    const password = await question('')
    process.stderr.write('\n')
    mute = false
    return await configureProfile(name, { api, loginName, password }, existing)
  } catch (error) {
    if (stop.signal.aborted) throw new CliError('login_cancelled', 'Login cancelled.')
    throw error
  } finally {
    if (mute) process.stderr.write('\n')
    terminal.close()
  }
}

const headers = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'Content-Security-Policy':
    "default-src 'none'; style-src 'unsafe-inline'; img-src data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  'Referrer-Policy': 'same-origin',
  'X-Content-Type-Options': 'nosniff',
}

async function formBody(request) {
  let size = 0
  const chunks = []
  for await (const chunk of request) {
    size += chunk.length
    if (size > 8192) throw new CliError('invalid_login', 'The login form exceeded the size limit.')
    chunks.push(chunk)
  }
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'))
}

export async function webLogin(name, defaults, existing, announce) {
  const host = '127.0.0.1'
  const path = `/login/${randomBytes(24).toString('base64url')}`
  let address
  let busy = false
  let closing = false
  let complete
  const result = new Promise((resolve) => {
    complete = resolve
  })
  const render = (request, response, status, values) => {
    const language = pageLanguage(request.headers['accept-language'])
    response
      .writeHead(status, headers)
      .end(loginPage({ name, locked: !!existing, language, ...values }))
  }
  const server = createServer(
    { requestTimeout: 15_000, headersTimeout: 10_000 },
    async (request, response) => {
      if (request.headers.host !== address.host || request.url !== path || closing) {
        response.writeHead(404, headers).end('Login page unavailable.')
        return
      }
      if (request.method === 'GET') {
        render(request, response, 200, defaults)
        return
      }
      if (
        request.method !== 'POST' ||
        request.headers.origin !== address.origin ||
        request.headers['content-type']?.split(';')[0] !== 'application/x-www-form-urlencoded'
      ) {
        response.writeHead(403, headers).end('Open the login page directly in your browser.')
        return
      }
      if (busy) {
        response.writeHead(409, headers).end('A login is already being saved.')
        return
      }

      busy = true
      let formValues = defaults
      try {
        const form = await formBody(request)
        formValues = {
          api: form.get('api') ?? '',
          loginName: form.get('loginName') ?? '',
        }
        const profile = await configureProfile(
          name,
          { ...formValues, password: form.get('password') },
          existing
        )
        closing = true
        render(request, response, 200, { saved: profile })
        complete(profile)
      } catch (error) {
        render(request, response, 400, {
          ...formValues,
          error: error instanceof CliError ? error.message : 'Could not save the profile.',
        })
      } finally {
        busy = false
        if (closing) complete(undefined)
      }
    }
  )

  server.listen(0, host)
  await once(server, 'listening')
  address = new URL(`http://${host}:${server.address().port}${path}`)
  const cancel = () => {
    closing = true
    if (!busy) complete(undefined)
  }
  const expiration = setTimeout(cancel, 10 * 60_000)
  process.once('SIGINT', cancel)
  try {
    announce(address.href)
    const profile = await result
    if (!profile) throw new CliError('login_cancelled', 'Login expired or was cancelled.')
    return profile
  } finally {
    closing = true
    clearTimeout(expiration)
    process.off('SIGINT', cancel)
    server.close()
    server.closeIdleConnections()
  }
}
