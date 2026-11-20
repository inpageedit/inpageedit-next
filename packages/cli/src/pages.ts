import { readFile } from 'node:fs/promises'
import { createTwoFilesPatch } from 'diff'
import { CliError } from './errors.js'
import type { Session } from './types.js'
import { csrfQuery } from './wiki.js'

export interface PageSource {
  title: string
  pageId: number
  revisionId: number
  contentModel: string
  section?: number
  text: string
}

export async function searchPages(session: Session, query: string, limit: number) {
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
  return data.query.search as { ns: number; title: string; pageid: number }[]
}

/**
 * Reads the latest revision of a title, or a given revision, optionally one section of it.
 * A revision ID is looked up on its own; the result's title says which page it belongs to.
 */
export async function getPage(
  session: Session,
  { title, revisionId, section }: { title: string; revisionId?: number; section?: number }
): Promise<PageSource> {
  const { data } = await session.wiki.get({
    ...session.assert,
    action: 'query',
    ...(revisionId === undefined ? { titles: title } : { revids: revisionId }),
    prop: 'revisions',
    rvslots: 'main',
    rvprop: 'ids|content|contentmodel',
    ...(section === undefined ? {} : { rvsection: section }),
  })
  if (data?.query?.badrevids) {
    throw new CliError('revision_not_found', 'The revision does not exist.')
  }
  const page = data?.query?.pages?.[0]
  if (page?.missing) throw new CliError('page_not_found', 'The page does not exist.')
  if (page?.invalid) throw new CliError('invalid_title', 'MediaWiki rejected the page title.')
  const revision = page?.revisions?.[0]
  const slot = revision?.slots?.main
  if (section !== undefined && page?.revisions && typeof slot?.content !== 'string') {
    throw new CliError('section_not_found', `The page has no section ${section}.`)
  }
  if (typeof slot?.content !== 'string' || !Number.isSafeInteger(revision.revid)) {
    throw new CliError('content_unavailable', 'MediaWiki did not return readable page content.')
  }
  return {
    title: page.title,
    pageId: page.pageid,
    revisionId: revision.revid,
    contentModel: slot.contentmodel,
    ...(section === undefined ? {} : { section }),
    text: slot.content,
  }
}

export async function pageText(file: string): Promise<string> {
  try {
    if (file !== '-') return await readFile(file, 'utf8')
    if (!process.stdin.isTTY) {
      const chunks: Buffer[] = []
      for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
      return Buffer.concat(chunks).toString('utf8')
    }
  } catch {
    throw new CliError('input_error', 'Could not read the page content.')
  }
  throw new CliError('input_error', 'Pipe page content to stdin when using --file -.')
}

export async function writePage(
  session: Session,
  {
    title,
    text,
    summary,
    baseRevision,
    section,
  }: { title: string; text: string; summary: string; baseRevision?: number; section?: number }
) {
  if (baseRevision) {
    const { data } = await session.wiki.get({
      ...session.assert,
      action: 'paraminfo',
      modules: 'edit',
    })
    const parameters = data?.paraminfo?.modules?.[0]?.parameters
    if (!parameters?.some((parameter: { name: string }) => parameter.name === 'baserevid')) {
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
      ...(section === undefined ? {} : { section }),
      ...(baseRevision ? { baserevid: baseRevision, nocreate: true } : { createonly: true }),
    },
    { retry: 1 }
  )
  const edit = data?.edit
  if (edit?.result !== 'Success') {
    throw new CliError('edit_failed', 'MediaWiki did not confirm the edit.')
  }
  return {
    title: edit.title as string,
    pageId: edit.pageid as number,
    oldRevisionId: edit.oldrevid as number,
    revisionId: (edit.newrevid ?? edit.oldrevid) as number,
    changed: edit.nochange !== true,
  }
}

/** A unified diff from the Wiki's revision to the local text. */
export function diffPage(page: PageSource, text: string, file: string) {
  const name = page.section === undefined ? page.title : `${page.title} §${page.section}`
  const diff =
    page.text === text
      ? ''
      : createTwoFilesPatch(name, file, page.text, text, `revision ${page.revisionId}`, 'local')
  return {
    title: page.title,
    revisionId: page.revisionId,
    ...(page.section === undefined ? {} : { section: page.section }),
    changed: diff !== '',
    diff,
  }
}

export interface Preview {
  title: string
  warnings: string[]
  categories: { title: string; hidden: boolean; missing: boolean }[]
  missingTemplates: string[]
  redLinks: string[]
  html: string
}

/** Parses local wikitext as the Wiki would on save, without saving. */
export async function previewPage(session: Session, title: string, text: string): Promise<Preview> {
  const { data } = await session.wiki.post({
    ...session.assert,
    action: 'parse',
    title,
    text,
    contentmodel: 'wikitext',
    pst: true,
    prop: 'text|categories|templates|links|parsewarnings',
    disablelimitreport: true,
    disableeditsection: true,
  })
  const parse = data?.parse
  if (typeof parse?.text !== 'string') {
    throw new CliError('unexpected_response', 'MediaWiki did not return a parse result.')
  }
  const missing = (items: any[] = []) =>
    items.filter((item) => item.exists === false).map((item) => item.title as string)
  const missingTemplates = missing(parse.templates)
  return {
    title: parse.title,
    warnings: parse.parsewarnings ?? [],
    categories: (parse.categories ?? []).map((category: any) => ({
      title: category.category,
      hidden: category.hidden === true,
      missing: category.missing === true,
    })),
    missingTemplates,
    // A missing template also renders as a red link to itself; report it once.
    redLinks: missing(parse.links).filter((title) => !missingTemplates.includes(title)),
    html: parse.text,
  }
}

/** A standalone page for the rendered preview; links resolve against the Wiki. */
export function previewDocument(preview: Preview, api: string) {
  const escape = (value: string) =>
    value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<base href="${escape(new URL('./', api).href)}">
<title>Preview · ${escape(preview.title)}</title>
</head>
<body>
<h1>${escape(preview.title)}</h1>
${preview.html}
</body>
</html>
`
}
