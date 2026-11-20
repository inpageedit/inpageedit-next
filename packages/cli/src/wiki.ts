import { EnvHttpProxyAgent } from 'undici'
import { MwApi, MediaWikiApiError, WikiSaikouErrorCode } from 'wiki-saikou'
import { CliError, loginRequired } from './errors.js'
import { apiEndpoint, savedPassword, savedSession, saveProfile, saveSession } from './profiles.js'
import type { Identity, Profile, Session } from './types.js'

// Node's fetch ignores http_proxy/https_proxy/no_proxy unless NODE_USE_ENV_PROXY is set;
// this agent honours them so the CLI works behind a non-transparent proxy.
const dispatcher = new EnvHttpProxyAgent()

function client(api: string): MwApi {
  const wiki = new MwApi({
    baseURL: api,
    throwOnApiError: true,
    fexiosConfigs: {
      // Fexios passes a complete Request, so only redirect and dispatcher go in the init.
      // The cast bridges @types/node's bundled undici-types and the undici package's types.
      fetch: (request: string | URL | Request) =>
        fetch(request, { redirect: 'error', dispatcher } as unknown as RequestInit),
      timeout: 15_000,
      headers: { 'user-agent': 'InPageEdit-CLI/0.1 (https://www.ipe.wiki/)' },
    },
  })
  wiki.request.on('beforeRequest', (ctx: any) => {
    const body = ctx.request.body
    if (
      body instanceof FormData &&
      body.get('action') === 'edit' &&
      [...body.values()].every((value) => typeof value === 'string')
    ) {
      // Multipart form serialization converts line endings in text fields to CRLF.
      ctx.request.body = new URLSearchParams(body as unknown as Record<string, string>)
    }
  })
  return wiki
}

async function queryIdentity(wiki: MwApi, assertions: Record<string, string>): Promise<Identity> {
  const { data } = await wiki.get({ action: 'query', meta: 'userinfo', ...assertions })
  const user = data?.query?.userinfo
  if (!user || !Number.isSafeInteger(user.id) || user.id <= 0 || typeof user.name !== 'string') {
    throw new CliError('login_failed', 'MediaWiki did not confirm the logged-in account.')
  }
  return { username: user.name, userId: user.id }
}

function session(wiki: MwApi, username: string, identity?: Identity): Session {
  return { wiki, assert: { assert: 'user', assertuser: username }, identity }
}

async function authenticate(
  api: string,
  loginName: string,
  password: string
): Promise<Session & { identity: Identity }> {
  const wiki = client(api)
  try {
    await wiki.login(loginName, password, undefined, { retry: 1 })
    const identity = await queryIdentity(wiki, { assert: 'user' })
    return { ...session(wiki, identity.username), identity }
  } catch (error) {
    if (error instanceof CliError) throw error
    if (
      (error as { code?: unknown }).code === WikiSaikouErrorCode.LOGIN_FAILED ||
      error instanceof MediaWikiApiError
    ) {
      throw new CliError(
        'login_failed',
        'MediaWiki refused the login. Check the Bot Password login name and password.'
      )
    }
    // SDK errors can include the request body and authentication cookies.
    throw new CliError(
      'wiki_unreachable',
      'Could not complete login at the API URL. Check the URL and connection.'
    )
  }
}

export async function configureProfile(
  name: string,
  input: { api: string; loginName: string; password: string | null },
  existing?: Profile
): Promise<Profile> {
  const api = apiEndpoint(input.api)
  const loginName = input.loginName.trim()
  if (!/^[^@]+@[^@]+$/.test(loginName) || !input.password) {
    throw new CliError(
      'invalid_login',
      'Enter the full Bot Password login name (User@Bot) and password.'
    )
  }
  if (existing && existing.api !== api) {
    throw new CliError(
      'profile_mismatch',
      'This profile is bound to another API URL. Use another profile name.'
    )
  }
  const loggedIn = await authenticate(api, loginName, input.password)
  const { username, userId } = loggedIn.identity
  if (existing && existing.userId !== userId) {
    throw new CliError(
      'profile_mismatch',
      'This profile is bound to another Wiki account. Use another profile name.'
    )
  }
  const profile = { name, api, loginName, username, userId }
  await saveProfile(profile, input.password, existing)
  await cacheSession(profile, loggedIn)
  return profile
}

async function cacheSession(
  profile: Profile,
  { wiki, identity }: Session & { identity: Identity }
) {
  const { hostname, pathname } = new URL(profile.api)
  const jar = (wiki.request as any).cookieJar
  const cookies = jar.getCookies(hostname, pathname).map((cookie: any) => {
    const { maxAge, _createdAt, ...rest } = cookie
    // CookieJar.setCookie resets Max-Age on insert. Persist its original absolute expiry.
    const expires = maxAge === undefined ? rest.expires : new Date(+_createdAt + maxAge * 1000)
    return { ...rest, expires }
  })
  await saveSession(profile, { username: identity.username, cookies })
}

async function restoreSession(profile: Profile): Promise<Session | undefined> {
  const cached = (await savedSession(profile)) as
    | { username?: unknown; cookies?: any[] }
    | undefined
  if (typeof cached?.username !== 'string' || !Array.isArray(cached.cookies)) return
  const wiki = client(profile.api)
  const jar = (wiki.request as any).cookieJar
  const now = Date.now()
  for (const cookie of cached.cookies) {
    if (typeof cookie?.name !== 'string' || typeof cookie.value !== 'string') return
    const expires = cookie.expires === undefined ? undefined : new Date(cookie.expires)
    if (expires && !(+expires > now)) continue
    jar.setCookie({ ...cookie, expires })
  }
  const { hostname, pathname } = new URL(profile.api)
  if (jar.getCookies(hostname, pathname).length) return session(wiki, cached.username)
}

function apiErrorCode(error: unknown): string | undefined {
  if (error instanceof MediaWikiApiError) return error.errors?.[0]?.code
}

function checkIdentity(profile: Profile, identity: Identity): Identity {
  if (identity.userId !== profile.userId) {
    throw new CliError(
      'identity_mismatch',
      'MediaWiki returned a different account for this profile.'
    )
  }
  return identity
}

export async function csrfQuery(
  session: Session,
  query: Record<string, string> = {}
): Promise<any> {
  const { data } = await session.wiki.get({
    ...query,
    ...session.assert,
    action: 'query',
    meta: 'tokens',
    type: 'csrf',
  })
  const token = data?.query?.tokens?.csrftoken
  if (typeof token !== 'string' || !token || token === '+\\') {
    throw new CliError(
      'unexpected_response',
      'MediaWiki did not provide an authenticated CSRF token.'
    )
  }
  return data
}

export async function wikiIdentity(current: Session, profile: Profile): Promise<Identity> {
  const identity = current.identity ?? (await queryIdentity(current.wiki, current.assert))
  return checkIdentity(profile, identity)
}

export async function withAnonymousSession<T>(
  api: string,
  operate: (session: Session) => Promise<T>
): Promise<T> {
  try {
    return await operate({ wiki: client(api), assert: {} })
  } catch (error) {
    throw wikiError(error)
  }
}

export async function withWikiSession<T>(
  profile: Profile,
  operate: (session: Session) => Promise<T>
): Promise<T> {
  try {
    const cached = await restoreSession(profile)
    if (cached) {
      try {
        return await operate(cached)
      } catch (error) {
        // These server responses reject the operation before executing it, including private Wikis.
        if (
          !['assertuserfailed', 'assertnameduserfailed', 'readapidenied'].includes(
            apiErrorCode(error) ?? ''
          )
        ) {
          throw error
        }
      }
    }

    const password = await savedPassword(profile)
    if (!password) throw loginRequired(profile.name)
    const fresh = await authenticate(profile.api, profile.loginName, password)
    checkIdentity(profile, fresh.identity)
    await cacheSession(profile, fresh)
    return await operate(fresh)
  } catch (error) {
    throw wikiError(error, profile)
  }
}

function wikiError(error: any, profile?: Profile): CliError {
  if (error?.code === 'login_failed' && profile) return loginRequired(profile.name)
  if (error instanceof CliError) return error
  if (error instanceof MediaWikiApiError) {
    const { code, text } = error.firstError ?? {}
    if (profile && ['assertuserfailed', 'assertnameduserfailed'].includes(code ?? ''))
      return loginRequired(profile.name)
    // Extensions can return codes such as internal_api_error_<PHP class>; keep the
    // server's own text so callers see why, but never the request that caused it.
    const known = typeof code === 'string' && /^[a-z0-9_-]{1,80}$/i.test(code)
    return new CliError(
      known ? code : 'mediawiki_error',
      `MediaWiki rejected the operation${known ? ` (${code})` : ''}: ${text || code || 'no details'}`,
      known ? undefined : { apiCode: code }
    )
  }
  // SDK errors carry the request context, which holds the body and session cookies.
  // Report only the transport-level code and HTTP status.
  const status = error.cause?.response?.status
  const cause = [error.code, error.cause?.code, status && `HTTP ${status}`].filter(
    (part) => typeof part === 'string' && /^[A-Za-z0-9_ ]{1,40}$/.test(part)
  )
  return new CliError(
    'wiki_request_failed',
    `The MediaWiki request could not be completed${cause.length ? ` (${cause.join(', ')})` : ''}.`
  )
}
