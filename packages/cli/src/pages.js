import { readFile } from 'node:fs/promises'
import { CliError } from './errors.js'
import { csrfQuery } from './wiki.js'

export async function searchPages(session, query, limit) {
  const { data } = await session.wiki.get({
    ...session.assert,
    action: 'query',
    list: 'search',
    srsearch: query,
    srlimit: limit,
    srprop: '',
  })
  if (!Array.isArray(data?.query?.search)) {
    throw new CliError('unexpected_response', 'MediaWiki did not return search results.')
  }
  return data.query.search
}

export async function getPage(session, title) {
  const { data } = await session.wiki.get({
    ...session.assert,
    action: 'query',
    titles: title,
    prop: 'revisions',
    rvslots: 'main',
    rvprop: 'ids|content|contentmodel',
  })
  const page = data?.query?.pages?.[0]
  if (page?.missing) throw new CliError('page_not_found', 'The page does not exist.')
  if (page?.invalid) throw new CliError('invalid_title', 'MediaWiki rejected the page title.')
  const revision = page?.revisions?.[0]
  const slot = revision?.slots?.main
  if (typeof slot?.content !== 'string' || !Number.isSafeInteger(revision.revid)) {
    throw new CliError('content_unavailable', 'MediaWiki did not return readable page content.')
  }
  return {
    title: page.title,
    pageId: page.pageid,
    revisionId: revision.revid,
    contentModel: slot.contentmodel,
    text: slot.content,
  }
}

export async function pageText(file) {
  try {
    if (file !== '-') return await readFile(file, 'utf8')
    if (!process.stdin.isTTY) {
      const chunks = []
      for await (const chunk of process.stdin) chunks.push(chunk)
      return Buffer.concat(chunks).toString('utf8')
    }
  } catch {
    throw new CliError('input_error', 'Could not read the page content.')
  }
  throw new CliError('input_error', 'Pipe page content to stdin when using --file -.')
}

export async function writePage(session, { title, text, summary, baseRevision }) {
  if (baseRevision) {
    const { data } = await session.wiki.get({
      ...session.assert,
      action: 'paraminfo',
      modules: 'edit',
    })
    const parameters = data?.paraminfo?.modules?.[0]?.parameters
    if (!parameters?.some((parameter) => parameter.name === 'baserevid')) {
      throw new CliError(
        'edit_conflict_check_unavailable',
        'This Wiki does not support revision-based edit conflict checks.'
      )
    }
  }

  const tokenResponse = await csrfQuery(
    session,
    baseRevision ? { prop: 'info', titles: title } : {}
  )

  if (baseRevision) {
    const page = tokenResponse.query?.pages?.[0]
    if (page?.missing) throw new CliError('page_not_found', 'The page does not exist.')
    if (page?.invalid) throw new CliError('invalid_title', 'MediaWiki rejected the page title.')
    if (!Number.isSafeInteger(page?.lastrevid)) {
      throw new CliError('content_unavailable', 'MediaWiki did not return the current revision ID.')
    }
    if (page.lastrevid !== baseRevision) {
      throw new CliError(
        'editconflict',
        'The page has changed. Read the latest revision before editing.'
      )
    }
  }
  const { data } = await session.wiki.postWithToken(
    'csrf',
    {
      ...session.assert,
      action: 'edit',
      title,
      text,
      summary,
      ...(baseRevision ? { baserevid: baseRevision, nocreate: true } : { createonly: true }),
    },
    { retry: 1 }
  )
  const edit = data?.edit
  if (edit?.result !== 'Success') {
    throw new CliError('edit_failed', 'MediaWiki did not confirm the edit.')
  }
  return {
    title: edit.title,
    pageId: edit.pageid,
    oldRevisionId: edit.oldrevid,
    revisionId: edit.newrevid ?? edit.oldrevid,
    changed: edit.nochange !== true,
  }
}
