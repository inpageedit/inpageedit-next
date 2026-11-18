import { MwApi, MediaWikiApiError, WikiSaikouErrorCode } from 'wiki-saikou'
import { CliError, loginRequired } from './errors.js'
import { apiEndpoint, savedPassword, savedSession, saveProfile, saveSession } from './profiles.js'

function client(api) {
  const wiki = new MwApi({
    baseURL: api,
    throwOnApiError: true,
    fexiosConfigs: {
      fetch: (request) => fetch(request, { redirect: 'error' }),
      timeout: 15_000,
      headers: { 'user-agent': 'InPageEdit-CLI/0.1 (https://www.ipe.wiki/)' },
    },
  })
  wiki.request.on('beforeRequest', (ctx) => {
    const body = ctx.request.body
    if (
      body instanceof FormData &&
      body.get('action') === 'edit' &&
      [...body.values()].every((value) => typeof value === 'string')
    ) {
      // Multipart form serialization converts line endings in text fields to CRLF.
      ctx.request.body = new URLSearchParams(body)
    }
  })
  return wiki
}

async function queryIdentity(wiki, assertions) {
  const { data } = await wiki.get({ action: 'query', meta: 'userinfo', ...assertions })
  const user = data?.query?.userinfo
  if (!user || !Number.isSafeInteger(user.id) || user.id <= 0 || typeof user.name !== 'string') {
    throw new CliError('login_failed', 'MediaWiki did not confirm the logged-in account.')
  }
  return { username: user.name, userId: user.id }
}

function session(wiki, username, identity) {
  return { wiki, assert: { assert: 'user', assertuser: username }, identity }
}

async function authenticate(api, loginName, password) {
  const wiki = client(api)
  try {
    await wiki.login(loginName, password, undefined, { retry: 1 })
    const identity = await queryIdentity(wiki, { assert: 'user' })
    return session(wiki, identity.username, identity)
  } catch (error) {
    if (error instanceof CliError) throw error
    if (error.code === WikiSaikouErrorCode.LOGIN_FAILED || error instanceof MediaWikiApiError) {
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

export async function configureProfile(name, input, existing) {
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

async function cacheSession(profile, { wiki, identity }) {
  const { hostname, pathname } = new URL(profile.api)
  const cookies = wiki.request.cookieJar.getCookies(hostname, pathname).map((cookie) => {
    const { maxAge, _createdAt, ...rest } = cookie
    // CookieJar.setCookie resets Max-Age on insert. Persist its original absolute expiry.
    const expires = maxAge === undefined ? rest.expires : new Date(+_createdAt + maxAge * 1000)
    return { ...rest, expires }
  })
  await saveSession(profile, { username: identity.username, cookies })
}

async function restoreSession(profile) {
  const cached = await savedSession(profile)
  if (typeof cached?.username !== 'string' || !Array.isArray(cached.cookies)) return
  const wiki = client(profile.api)
  const jar = wiki.request.cookieJar
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

function apiErrorCode(error) {
  if (error instanceof MediaWikiApiError) return error.errors?.[0]?.code
}

function checkIdentity(profile, identity) {
  if (identity.userId !== profile.userId) {
    throw new CliError(
      'identity_mismatch',
      'MediaWiki returned a different account for this profile.'
    )
  }
  return identity
}

export async function csrfQuery(session, query = {}) {
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

export async function wikiIdentity(current, profile) {
  const identity = current.identity ?? (await queryIdentity(current.wiki, current.assert))
  return checkIdentity(profile, identity)
}

export async function withWikiSession(profile, operate) {
  try {
    const cached = await restoreSession(profile)
    if (cached) {
      try {
        return await operate(cached)
      } catch (error) {
        // These server responses reject the operation before executing it, including private Wikis.
        if (
          !['assertuserfailed', 'assertnameduserfailed', 'readapidenied'].includes(
            apiErrorCode(error)
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

function wikiError(error, profile) {
  if (error.code === 'login_failed') return loginRequired(profile.name)
  if (error instanceof CliError) return error
  if (error instanceof MediaWikiApiError) {
    const code = apiErrorCode(error)
    if (['assertuserfailed', 'assertnameduserfailed'].includes(code))
      return loginRequired(profile.name)
    if (typeof code === 'string' && /^[a-z0-9_-]{1,80}$/i.test(code)) {
      return new CliError(code, `MediaWiki rejected the operation (${code}).`)
    }
  }
  return new CliError('wiki_request_failed', 'The MediaWiki request could not be completed.')
}
