import { basename } from 'node:path'
import { actionRequest, formFile } from './action-api.js'
import { CliError } from './errors.js'
import { pageText } from './pages.js'
import type { Session, Values } from './types.js'

export function prepareMove(from: string, to: string, values: Values): FormData {
  if (
    !from.trim() ||
    from.includes('|') ||
    !to.trim() ||
    to.includes('|') ||
    !values.reason?.trim()
  ) {
    throw new CliError('usage_error', 'Page moves require two page titles and --reason TEXT.')
  }
  const form = new FormData()
  form.set('action', 'move')
  form.set('from', from)
  form.set('to', to)
  form.set('reason', values.reason)
  if (values['move-talk']) form.set('movetalk', '1')
  if (values['no-redirect']) form.set('noredirect', '1')
  return form
}

export async function prepareUpload(path: string, values: Values): Promise<FormData> {
  const filename = values.filename ?? basename(path)
  if (!filename.trim() || filename.includes('|')) {
    throw new CliError('usage_error', 'Specify a non-empty Wiki filename.')
  }
  const form = new FormData()
  form.set('action', 'upload')
  form.set('filename', filename)
  if (values.summary !== undefined) form.set('comment', values.summary)
  if (values['description-file'] !== undefined) {
    form.set('text', await pageText(values['description-file']))
  }
  if (values['ignore-warnings']) form.set('ignorewarnings', '1')
  await formFile(form, 'file', path, filename)
  return form
}

export async function movePage(session: Session, form: FormData) {
  const data = await actionRequest(session, { method: 'POST', form, token: 'csrf' })
  const move = data?.move
  if (typeof move?.from !== 'string' || typeof move?.to !== 'string') {
    throw new CliError('move_failed', 'MediaWiki did not confirm the page move.')
  }
  return data.warnings ? { ...move, warnings: data.warnings } : move
}

export async function uploadFile(session: Session, form: FormData) {
  const data = await actionRequest(session, { method: 'POST', form, token: 'csrf' })
  const upload = data?.upload
  if (upload?.result === 'Warning') {
    const codes = Object.keys(upload.warnings ?? {})
    throw new CliError(
      'upload_warning',
      `MediaWiki returned upload warnings${codes.length ? ` (${codes.join(', ')})` : ''}. Review them before using --ignore-warnings.`,
      { warnings: upload.warnings, fileKey: upload.filekey }
    )
  }
  if (upload?.result !== 'Success' || typeof upload.filename !== 'string') {
    throw new CliError('upload_failed', 'MediaWiki did not confirm the upload.')
  }
  return upload
}
