import { MwApi, MediaWikiApiError, WikiSaikouErrorCode } from 'wiki-saikou'
import { CliError, loginRequired } from './errors.js'
import { apiEndpoint, savedPassword, saveProfile } from './profiles.js'

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
    if (body instanceof FormData && body.get('action') === 'edit') {
      // Multipart form serialization converts line endings in text fields to CRLF.
      ctx.request.body = new URLSearchParams(body)
    }
  })
  return wiki
}

async function authenticate(api, loginName, password) {
  const wiki = client(api)
  try {
    await wiki.login(loginName, password, undefined, { retry: 1 })
    const { data } = await wiki.get({ action: 'query', meta: 'userinfo', assert: 'user' })
    const user = data?.query?.userinfo
    if (!user || !Number.isSafeInteger(user.id) || user.id <= 0 || typeof user.name !== 'string') {
      throw new CliError('login_failed', 'MediaWiki did not confirm the logged-in account.')
    }
    return { wiki, username: user.name, userId: user.id }
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
  const { username, userId } = await authenticate(api, loginName, input.password)
  if (existing && existing.userId !== userId) {
    throw new CliError(
      'profile_mismatch',
      'This profile is bound to another Wiki account. Use another profile name.'
    )
  }
  const profile = { name, api, loginName, username, userId }
  await saveProfile(profile, input.password, existing)
  return profile
}

export async function wikiSession(profile) {
  const password = await savedPassword(profile)
  if (!password) throw loginRequired(profile.name)
  try {
    const session = await authenticate(profile.api, profile.loginName, password)
    if (session.userId !== profile.userId) {
      throw new CliError(
        'identity_mismatch',
        'MediaWiki returned a different account for this profile.'
      )
    }
    return { ...session, assert: { assert: 'user', assertuser: session.username } }
  } catch (error) {
    if (error.code === 'login_failed') throw loginRequired(profile.name)
    throw error
  }
}

export function wikiError(error, profile) {
  if (error instanceof CliError) return error
  if (error instanceof MediaWikiApiError) {
    const code = error.errors?.[0]?.code
    if (['assertuserfailed', 'assertnameduserfailed'].includes(code))
      return loginRequired(profile.name)
    if (typeof code === 'string' && /^[a-z0-9_-]{1,80}$/i.test(code)) {
      return new CliError(code, `MediaWiki rejected the operation (${code}).`)
    }
  }
  return new CliError('wiki_request_failed', 'The MediaWiki request could not be completed.')
}
