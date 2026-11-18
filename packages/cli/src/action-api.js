import { openAsBlob } from 'node:fs'
import { basename } from 'node:path'
import { CliError } from './errors.js'
import { pageText } from './pages.js'
import { csrfQuery } from './wiki.js'

function usage(message) {
  return new CliError('usage_error', message)
}

function parameterPairs(values = []) {
  return values.map((item) => {
    const separator = item.indexOf('=')
    if (separator < 1) throw usage('Expected an API parameter in KEY=VALUE form.')
    return [item.slice(0, separator), item.slice(separator + 1)]
  })
}

async function jsonBody(path) {
  let value
  try {
    value = JSON.parse(await pageText(path))
  } catch (error) {
    if (error instanceof CliError) throw error
    throw usage('--body requires a JSON object.')
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw usage('--body requires a JSON object.')
  }
  return Object.entries(value).flatMap(([key, value]) => {
    if (value === false || value === null) return []
    if (!['string', 'number', 'boolean'].includes(typeof value)) {
      throw usage('--body values must be strings, numbers, booleans, or null.')
    }
    return [[key, value === true ? '1' : String(value)]]
  })
}

export async function formFile(form, field, path, name = basename(path)) {
  try {
    form.set(field, await openAsBlob(path), name)
  } catch {
    throw new CliError('input_error', 'Could not open the file for upload.')
  }
}

export async function prepareActionRequest(values) {
  const method = (values.method ?? 'GET').toUpperCase()
  if (!['GET', 'POST'].includes(method)) throw usage('--method must be GET or POST.')
  if (method === 'GET' && (values.body !== undefined || values.form || values.token)) {
    throw usage('--body, --form, and --token require --method POST.')
  }
  if (values.body !== undefined && values.form) throw usage('Use either --body or --form.')
  if (values.token !== undefined && values.token !== 'csrf') {
    throw usage('--token supports csrf.')
  }

  const query = parameterPairs(values.query)
  const fields =
    values.body === undefined ? parameterPairs(values.form) : await jsonBody(values.body)
  const keys = new Set(['assert', 'assertuser', 'format', ...(values.token ? ['token'] : [])])
  for (const [key] of [...query, ...fields]) {
    if (!/^[a-z][a-z0-9_-]*$/i.test(key) || keys.has(key)) {
      throw usage(`Invalid, duplicate, or reserved API parameter: ${key}.`)
    }
    keys.add(key)
  }
  const action = [...query, ...fields].find(([key]) => key === 'action')?.[1]
  if (!/^[a-z][a-z0-9_-]*$/i.test(action ?? '')) {
    throw usage('Supply an explicit Action API action.')
  }

  const form = new FormData()
  for (const [key, value] of fields) {
    if (values.form && value.startsWith('@')) await formFile(form, key, value.slice(1))
    else form.set(key, value)
  }
  return { method, query: Object.fromEntries(query), form, token: values.token }
}

export async function actionRequest(session, { method, query, form, token }) {
  if (method === 'GET') {
    return (await session.wiki.get({ ...query, ...session.assert })).data
  }
  const payload = new FormData()
  for (const [key, value] of form) payload.set(key, value)
  for (const [key, value] of Object.entries(session.assert)) payload.set(key, value)
  if (token) payload.set('token', (await csrfQuery(session)).query.tokens.csrftoken)
  return (await session.wiki.post(payload, { query })).data
}
