import { Inject, InPageEdit, Schema } from '@/InPageEdit'

import './style.scss'

import BasePlugin from '@/plugins/BasePlugin'
import { RegisterPreferences } from '@/decorators/Preferences'
import { IconUpload } from '@/components/Icon'
import { CheckBox } from '@/components'
import type { UploadFileResult } from '@/services/WikiFileService'

declare module '@/InPageEdit' {
  interface InPageEdit {
    quickUpload: PluginQuickUpload
  }
  interface Preferences {
    'quickUpload.summary': string
  }
}

type UploadItem = {
  id: string
  file: File
  filename: string
  text: string
  license: string
  status: 'queued' | 'uploading' | 'success' | 'warning' | 'error' | 'paused'
  message?: string
  retryable?: boolean
  fileUrl?: string
  result?: UploadFileResult
}

type LicenseOption = {
  value: string
  label: string
  disabled?: boolean
  depth: number
}

function parseLicenses(msg = ''): LicenseOption[] {
  const text = msg.trim()
  if (!text || text === '-') return []

  const options: LicenseOption[] = []
  const levels: string[] = []

  for (const raw of text.split(/\r?\n/)) {
    if (!raw.startsWith('*')) continue
    let stars = 0
    while (raw[stars] === '*') stars++
    const line = raw.slice(stars).replace(/^ +/, '')
    if (!line) continue

    if (line.includes('|')) {
      const pipe = line.lastIndexOf('|')
      options.push({
        value: line.slice(0, pipe),
        label: line.slice(pipe + 1),
        depth: levels.length,
      })
    } else {
      if (stars < levels.length) levels.length = stars
      if (stars === levels.length) levels[stars - 1] = line
      else levels.push(line)
      options.push({ value: '', label: line, disabled: true, depth: levels.length - 1 })
    }
  }

  return options
}

/** @see https://doc.wikimedia.org/mediawiki-core/master/php/Licenses_8php_source.html */
async function fetchUploadLicenses(
  api: { get: (params: Record<string, any>) => Promise<{ data: any }> },
  lang: string
) {
  const { data } = await api.get({
    action: 'query',
    meta: 'allmessages',
    ammessages: 'licenses|license-header',
    amlang: lang,
  })
  const msgs: Record<string, string> = {}
  for (const m of data.query.allmessages) msgs[m.name] = m.content
  return {
    options: parseLicenses(msgs.licenses),
    licenseHeader: msgs['license-header'],
  }
}

const PreviewPlaceholderNA = ({ $ }: { $: (strings: TemplateStringsArray) => string }) => (
  <div className="ipe-quickUpload__preview-placeholder is-na">
    <span>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="currentColor"
        class="icon icon-tabler icons-tabler-filled icon-tabler-file-unknown"
      >
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M12 2l.117 .007a1 1 0 0 1 .876 .876l.007 .117v4l.005 .15a2 2 0 0 0 1.838 1.844l.157 .006h4l.117 .007a1 1 0 0 1 .876 .876l.007 .117v9a3 3 0 0 1 -2.824 2.995l-.176 .005h-10a3 3 0 0 1 -2.995 -2.824l-.005 -.176v-14a3 3 0 0 1 2.824 -2.995l.176 -.005zm0 15a1 1 0 0 0 -.993 .883l-.007 .127a1 1 0 0 0 1.993 .117l.007 -.127a1 1 0 0 0 -1 -1m1.136 -5.727a2.5 2.5 0 0 0 -3.037 .604a1 1 0 0 0 1.434 1.389l.088 -.09a.5 .5 0 1 1 .379 .824a1 1 0 0 0 -.002 2a2.5 2.5 0 0 0 1.137 -4.727" />
        <path d="M19 7h-4l-.001 -4.001z" />
      </svg>
      <p>{$`No preview available`}</p>
    </span>
  </div>
)

@RegisterPreferences(
  Schema.object({
    'quickUpload.summary': Schema.string()
      .description('Default summary of the quick upload')
      .default('[IPE-NEXT] Quick upload'),
  })
)
@Inject([
  'modal',
  '$',
  'wikiTitle',
  'wikiFile',
  'quickPreview',
  'preferences',
  'wiki',
  'apiService',
])
export class PluginQuickUpload extends BasePlugin {
  constructor(public ctx: InPageEdit) {
    super(ctx, {}, 'quick-upload')
  }

  protected async start() {
    this.injectToolbox()
    this.ctx.set('quickUpload', this)
  }

  protected async stop() {}

  private injectToolbox() {
    const { $ } = this.ctx
    this.ctx.inject(['toolbox'], (ctx) => {
      ctx.toolbox.addButton({
        id: 'quick-upload',
        group: 'group2',
        index: 2,
        icon: <IconUpload />,
        tooltip: () => $`Quick Upload`,
        onClick: (e) => {
          e.preventDefault()
          this.showModal()
        },
      })
      ctx.on('dispose', () => {
        ctx.toolbox.removeButton('quick-upload')
      })
    })
  }

  private formatFileSize(size: number = 0) {
    size = Number(size)
    if (!Number.isFinite(size) || size < 0) return '0 B'

    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let index = 0
    while (size >= 1024 && index < units.length - 1) {
      size /= 1024
      index++
    }

    // 使用 Intl 来格式化数字（自动处理千分位、小数等）
    const formatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })
    return `${formatter.format(size)} ${units[index]}`
  }

  private isFileAccepted(file: File, accept: string): boolean {
    if (!accept) return true
    const rules = accept
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (!rules.length) return true
    const fileType = file.type || ''
    const fileName = file.name || ''
    return rules.some((rule) => {
      // extension: .png .pdf
      if (rule.startsWith('.')) {
        return fileName.toLowerCase().endsWith(rule.toLowerCase())
      }
      // image/*, video/* ...
      if (rule.endsWith('/*')) {
        const prefix = rule.slice(0, -1) // keep the trailing slash
        return fileType.startsWith(prefix)
      }
      // exact mime
      return fileType === rule
    })
  }

  private getDefaultPreviewPlaceholder() {
    const { $ } = this.ctx
    return (
      <div className="ipe-quickUpload__preview-placeholder">
        <span>
          <IconUpload />
          <p>{$`You can drag & drop files to this modal`}</p>
        </span>
      </div>
    )
  }

  private safeId() {
    return `mu_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
  }

  async showModal() {
    const { $ } = this.ctx

    let isUploading = false
    let pauseRequested = false

    const showMessage = (type: 'success' | 'warning' | 'error', title: string, content: any) => {
      this.ctx.modal.notify(type, {
        title,
        content,
        closeAfter: type === 'success' ? 3000 : 8000,
      })
    }

    const modal = this.ctx.modal.show({
      className: 'ipe-quickUpload compact-buttons',
      sizeClass: 'mediumToLarge',
      center: false,
      title: $`Quick Upload`,
      content: $`Quick Upload`,
      outSideClose: false,
      beforeClose: () => {
        if (isUploading) {
          showMessage('warning', $`Upload in progress`, $`Please pause or wait for it to finish.`)
          return false
        }
        return true
      },
    })

    const repo = this.ctx.wikiFile.writableFileRepo
    const targetApi = repo ? this.ctx.apiService.getClientByFileRepo(repo) : undefined
    const targetLang = await this.ctx.wiki.getContentLanguage(targetApi)
    const licensesPromise = fetchUploadLicenses(targetApi || this.ctx.api, targetLang).catch(
      (e) => {
        this.logger.warn('Failed to fetch upload licenses', e)
        return null
      }
    )
    const defaultSummary = (await this.ctx.preferences.get('quickUpload.summary')) || ''
    const exts = await this.ctx.wiki.getAllowedFileExtensions(targetApi)

    const accept = exts.map((e) => `.${e}`).join(',')
    const confirmThreshold = 20

    let licenseOptions: LicenseOption[] = []
    let licenseHeader = ''

    let items: UploadItem[] = []
    let selectedId: string | null = null

    const ui = {
      fileInput: null as HTMLInputElement | null,
      listEl: null as HTMLElement | null,
      previewWrapper: null as HTMLElement | null,
      progressEl: null as HTMLElement | null,
      progressTextEl: null as HTMLElement | null,
      summaryInput: null as HTMLTextAreaElement | null,
      ignoreWarnings: null as HTMLInputElement | null,
      selectedCountEl: null as HTMLElement | null,
      readyCountEl: null as HTMLElement | null,
    }

    const updateItem = (id: string, patch: Partial<UploadItem>) => {
      items = items.map((x) => (x.id === id ? { ...x, ...patch } : x))
    }

    const removeItem = (id: string) => {
      items = items.filter((x) => x.id !== id)
      if (selectedId === id) {
        selectedId = items[0]?.id ?? null
      }
    }

    const updateMany = (ids: Set<string>, fn: (it: UploadItem) => UploadItem) => {
      items = items.map((x) => (ids.has(x.id) ? fn(x) : x))
    }

    const summarizeApiErrors = (e: any) => {
      const out: string[] = []
      const s = (v: any) => (v == null ? '' : String(v))
      if (e instanceof Error) {
        out.push(e.message)
        let cur: any = e
        while (cur?.cause) {
          cur = cur.cause
          if (cur instanceof Error) out.push(cur.message)
          else break
        }
      } else if (e?.data?.error?.info) {
        out.push(s(e.data.error.info))
      } else if (e?.error?.info) {
        out.push(s(e.error.info))
      } else if (e?.message) {
        out.push(s(e.message))
      }
      return out.filter(Boolean)
    }

    const formatUploadError = (e: any): { message: string; retryable: boolean } => {
      let reasons = summarizeApiErrors(e)
      if (reasons.length === 0) reasons = ['Upload failed with unknown error.']

      const combined = reasons.join('\n')
      const lower = combined.toLowerCase()

      if (
        lower.includes('file is larger') ||
        lower.includes('files larger than') ||
        lower.includes('maximum upload size')
      ) {
        return { message: `File too large\n${combined}`, retryable: false }
      }

      if (lower.includes('network') || lower.includes('timeout') || lower.includes('timed out')) {
        return { message: `Network issue\n${combined}`, retryable: true }
      }

      return { message: combined, retryable: true }
    }

    const shouldRetryItem = (it: UploadItem) => {
      if (it.status === 'warning') return true
      if (it.status === 'error') return it.retryable !== false
      return false
    }

    type UploadMode = 'all' | 'confirmed' | 'resume' | 'retry'

    const getUploadCandidates = (mode: UploadMode, list: UploadItem[]) => {
      if (mode === 'retry') return list.filter((it) => shouldRetryItem(it))
      if (mode === 'resume') {
        return list.filter(
          (it) => (it.status === 'queued' || it.status === 'paused') && it.retryable !== false
        )
      }
      return list.filter((it) => it.status === 'queued' || it.status === 'paused')
    }

    const prepareRetryState = (candidates: UploadItem[]) => {
      const idset = new Set(candidates.map((c) => c.id))
      updateMany(idset, (x) =>
        x.retryable === false ? x : { ...x, status: 'queued', message: undefined }
      )
    }

    const getSelected = () => {
      return items.find((x) => x.id === selectedId) || null
    }

    const setSelected = (id: string | null) => {
      selectedId = id
      renderList()
      void renderPreview()
    }

    const countByStatus = () => {
      const out = { ok: 0, warn: 0, err: 0, paused: 0 }
      for (const it of items) {
        if (it.status === 'success') out.ok++
        else if (it.status === 'warning') out.warn++
        else if (it.status === 'error') out.err++
        else if (it.status === 'paused') out.paused++
      }
      return out
    }

    const setProgress = (done: number, total: number) => {
      const pct = total > 0 ? Math.floor((done / total) * 100) : 0
      if (ui.progressTextEl) ui.progressTextEl.textContent = `${done}/${total} (${pct}%)`
      if (ui.progressEl) ui.progressEl.style.width = `${Math.max(0, Math.min(100, pct))}%`
    }

    const sanitizeFilename = (name: string) => {
      return (name || '').replace(/\s+/g, ' ').trim()
    }

    const resetAll = () => {
      items = []
      selectedId = null
      setProgress(0, 0)
      if (ui.summaryInput) ui.summaryInput.value = String(defaultSummary || '')
      if (ui.ignoreWarnings) ui.ignoreWarnings.checked = false
      renderList()
      void renderPreview()
    }

    const addFiles = (files: File[]) => {
      const accepted = files.filter((f) => this.isFileAccepted(f, String(accept || '')))

      const rejectedCount = files.length - accepted.length
      if (rejectedCount > 0) {
        showMessage(
          'warning',
          $`File type not allowed`,
          <span style={{ wordWrap: 'break-word' }}>
            {rejectedCount === 1
              ? $`1 file skipped! Only ${accept} are allowed by this wiki.`
              : $`${rejectedCount} files skipped! Only ${accept} are allowed by this wiki.`}
          </span>
        )
      }

      if (!accepted.length) return

      const newItems: UploadItem[] = accepted.map((file) => ({
        id: this.safeId(),
        file,
        filename: file.name,
        text: '',
        license: '',
        status: 'queued',
        retryable: true,
      }))

      items = [...items, ...newItems]
      if (!selectedId && items.length) {
        selectedId = items[0].id
      }
      renderList()
      void renderPreview()
    }

    const buildUploadBody = (item: UploadItem) => {
      const body: Record<string, any> = {}

      body.filename = sanitizeFilename(item.filename || item.file.name)
      body.file = item.file

      const summary = (ui.summaryInput?.value || '').trim() || ''
      body.comment = summary

      const wrapped = item.license && `{{${item.license}}}`
      const desc = item.text || ''
      body.text =
        wrapped && !desc.includes(wrapped)
          ? `${desc}${desc ? '\n' : ''}== ${licenseHeader} ==\n${wrapped}\n`
          : desc

      if (ui.ignoreWarnings?.checked) {
        body.ignorewarnings = '1'
      }

      return body
    }

    const getStatusLabel = (status: UploadItem['status']) => {
      switch (status) {
        case 'queued':
          return 'Queued'
        case 'uploading':
          return 'Uploading'
        case 'success':
          return 'Uploaded'
        case 'warning':
          return 'Warning'
        case 'error':
          return 'Failed'
        case 'paused':
          return 'Paused'
        default:
          return status
      }
    }

    const renderList = () => {
      if (!ui.listEl) return
      ui.listEl.innerHTML = ''

      if (!isUploading) {
        setProgress(0, items.length)
      }

      if (!items.length) {
        ui.listEl.appendChild(
          <div className="ipe-quickUpload__list-empty">
            <p>No files selected.</p>
          </div>
        )
        updateFooter()
        return
      } else {
        const list = (<ul className="ipe-quickUpload__list" />) as HTMLUListElement

        items.forEach((item) => {
          const row = (
            <li
              className={`ipe-quickUpload__item${item.id === selectedId ? ' is-active' : ''}`}
              onClick={() => setSelected(item.id)}
            >
              <div className="ipe-quickUpload__item-row">
                <div className="ipe-quickUpload__item-main">
                  <div className="ipe-quickUpload__item-name">
                    <strong>{item.filename}</strong>
                  </div>
                  <div className="ipe-quickUpload__item-status">{getStatusLabel(item.status)}</div>
                </div>
                <div className="ipe-quickUpload__item-actions">
                  <button
                    type="button"
                    className="ipe-btn is-text"
                    title={'Remove'}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      removeItem(item.id)
                      renderList()
                      void renderPreview()
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>

              {item.message ? (
                <div className="ipe-quickUpload__item-message ipe-quickUpload__muted">
                  {item.message}
                </div>
              ) : null}
            </li>
          ) as HTMLLIElement

          list.appendChild(row)
        })

        ui.listEl.appendChild(list)
      }

      updateFooter()
    }

    const renderPreview = async () => {
      if (!ui.previewWrapper) return
      ui.previewWrapper.innerHTML = ''

      const item = getSelected()
      if (!item) {
        ui.previewWrapper.appendChild(this.getDefaultPreviewPlaceholder())
        return
      }

      const file = item.file

      const header = (
        <section className="ipe-quickUpload__preview-header">
          <div className="ipe-quickUpload__preview-title">
            <strong>{file.name}</strong>
            <span className="ipe-quickUpload__muted">{this.formatFileSize(file.size)}</span>
          </div>
          <div className="ipe-quickUpload__preview-meta">
            <span className="ipe-quickUpload__muted">{file.type || $`Unknown type`}</span>
            {item.fileUrl ? (
              <>
                <a href={item.fileUrl} target="_blank" rel="noopener noreferrer">
                  {$`Open file URL`}
                </a>
                <a
                  href={this.ctx.wiki.getUrl(`File:${item.filename}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {$`Open file page`}
                </a>
              </>
            ) : null}
          </div>
        </section>
      ) as HTMLElement

      const previewEl = (await this.ctx.quickPreview.getPreviewElement(file)) || (
        <PreviewPlaceholderNA $={$} />
      )

      const previewBox = (
        <div className="ipe-quickUpload__preview-content">{previewEl}</div>
      ) as HTMLElement

      const isLocked = item.status === 'success'
      const fieldClass = `ipe-input-box${isLocked ? ' is-locked' : ''}`
      const filenameEditor = (
        <div className={fieldClass}>
          <label htmlFor="mu_filename">{$`Target filename`}</label>
          <input
            id="mu_filename"
            name="mu_filename"
            type="text"
            value={item.filename}
            disabled={isUploading || isLocked}
            onInput={(e: Event) => {
              const v = (e.target as HTMLInputElement).value
              updateItem(item.id, { filename: v })
              renderList()
            }}
          />
        </div>
      ) as HTMLElement

      const descEditor = (
        <div className={fieldClass}>
          <label htmlFor="mu_text">File description</label>
          <textarea
            id="mu_text"
            name="text"
            placeholder={'This file is for...\n[[Category:XXX]]'}
            disabled={isUploading || isLocked}
            value={item.text || ''}
            onInput={(e: Event) => {
              const v = (e.target as HTMLTextAreaElement).value
              updateItem(item.id, { text: v })
              renderList()
            }}
          ></textarea>
        </div>
      ) as HTMLElement

      const licenseEditor =
        licenseOptions.length > 0 ? (
          <div className={fieldClass}>
            <label htmlFor="mu_license">{$`Licensing`}</label>
            <select
              id="mu_license"
              disabled={isUploading || isLocked}
              value={item.license}
              onChange={(e: Event) => {
                updateItem(item.id, { license: (e.target as HTMLSelectElement).value })
              }}
            >
              <option value="">{$`None selected`}</option>
              {licenseOptions.map((opt) => (
                <option value={opt.value} disabled={opt.disabled}>
                  {'\u00A0'.repeat(opt.depth * 2)}
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ) : null

      ui.previewWrapper.appendChild(header)
      ui.previewWrapper.appendChild(previewBox)
      ui.previewWrapper.appendChild(filenameEditor)
      if (licenseEditor) ui.previewWrapper.appendChild(licenseEditor)
      ui.previewWrapper.appendChild(descEditor)
    }

    const uploadOne = async (item: UploadItem) => {
      updateItem(item.id, { status: 'uploading', message: undefined })
      renderList()
      await renderPreview()

      const body = buildUploadBody(item)

      this.ctx.emit('analytics/event', {
        feature: 'quick-upload',
        page: body.filename?.toString() || undefined,
      })

      try {
        const result = await this.ctx.wikiFile.upload(body)

        if (result.data?.upload?.result === 'Success') {
          const fileUrl = this.ctx.wikiFile.getFileUrl(`File:${result.data.upload.filename}`)
          updateItem(item.id, {
            status: 'success',
            fileUrl,
            result: result.data.upload as any,
            retryable: true,
          })
          renderList()
          await renderPreview()
          return
        }

        throw result
      } catch (e) {
        let reasons: string[] = []

        if ((e as any)?.data?.upload) {
          const uploadResult = (e as any).data.upload as UploadFileResult

          if (uploadResult.result === 'Success') {
            const fname = (uploadResult as any).filename || body.filename
            const fileUrl = this.ctx.wikiFile.getFileUrl(`File:${fname}`)
            updateItem(item.id, {
              status: 'success',
              fileUrl,
              result: uploadResult,
              retryable: true,
            })
            renderList()
            await renderPreview()
            return
          }

          if (
            Array.isArray(uploadResult.warnings?.duplicate) &&
            uploadResult.warnings.duplicate.length > 0
          ) {
            reasons.push(`Duplicate of: ${uploadResult.warnings.duplicate.join(', ')}`)
            updateItem(item.id, {
              status: 'warning',
              message: reasons.join('\n'),
              result: uploadResult,
              retryable: true,
            })
            renderList()
            await renderPreview()
            return
          }

          if (uploadResult.warnings?.exists) {
            reasons.push('A file with the same name already exists.')
            updateItem(item.id, {
              status: 'warning',
              message: reasons.join('\n'),
              result: uploadResult,
              retryable: true,
            })
            renderList()
            await renderPreview()
            return
          }

          const { message, retryable } = formatUploadError(e)
          updateItem(item.id, { status: 'error', message, retryable })
          renderList()
          await renderPreview()
          return
        }

        const { message, retryable } = formatUploadError(e)
        updateItem(item.id, { status: 'error', message, retryable })
        renderList()
        await renderPreview()
      }
    }

    const uploadAll = async (mode: UploadMode = 'all') => {
      if (isUploading) return

      let candidates = getUploadCandidates(mode, items)

      if (mode === 'retry') {
        if (candidates.length === 0) {
          showMessage(
            'warning',
            'Nothing to retry',
            <div>There are no retryable failed/warning items.</div>
          )
          return
        }
      } else if (mode === 'resume') {
        if (candidates.length === 0) {
          showMessage(
            'warning',
            'Nothing to resume',
            <div>There are no queued paused items to continue.</div>
          )
          return
        }
      } else {
        if (items.length === 0) {
          showMessage(
            'warning',
            $`No files selected`,
            <div>{$`Please select one or more files.`}</div>
          )
          return
        }
        if (mode !== 'confirmed' && items.length > confirmThreshold) {
          this.ctx.modal.confirm(
            {
              title: $`Confirm bulk upload`,
              content: (
                <div>
                  {$`You are about to upload`} <strong>{items.length}</strong>{' '}
                  {$`files at once. Are you sure?`}
                </div>
              ),
              center: true,
              okBtn: { label: $`Upload`, className: 'is-primary is-ghost' },
              cancelBtn: { label: $`Cancel`, className: 'is-danger is-ghost' },
            },
            (confirmed) => {
              if (confirmed) {
                void uploadAll('confirmed')
              }
              return true
            }
          )
          return
        }
      }

      if (mode === 'retry') {
        prepareRetryState(candidates)
        renderList()
        await renderPreview()
        candidates = getUploadCandidates('retry', items)
      }

      isUploading = true
      pauseRequested = false
      updateFooter()

      try {
        const total = candidates.length
        let done = 0
        setProgress(0, total)

        for (const item of candidates) {
          if (pauseRequested) {
            const remainingIds = new Set(candidates.slice(done).map((x) => x.id))
            updateMany(remainingIds, (x) =>
              x.status === 'queued' || x.status === 'uploading'
                ? { ...x, status: 'paused', message: 'Paused by user', retryable: true }
                : x
            )
            renderList()
            await renderPreview()
            break
          }

          const current = items.find((x) => x.id === item.id)
          if (!current) {
            done++
            setProgress(done, total)
            continue
          }

          await uploadOne(current)
          done++
          setProgress(done, total)
        }

        const { ok, warn, err, paused } = countByStatus()
        if (paused > 0) {
          showMessage(
            'warning',
            'Upload paused',
            <div>
              <div>
                Uploaded: <strong>{ok}</strong>
              </div>
              <div>
                Warnings: <strong>{warn}</strong>
              </div>
              <div>
                Errors: <strong>{err}</strong>
              </div>
              <div>
                Paused: <strong>{paused}</strong>
              </div>
            </div>
          )
        } else if (err === 0 && warn === 0) {
          showMessage(
            'success',
            'Upload completed',
            <div>
              <strong>All files uploaded successfully.</strong>
              <div>
                Uploaded: <strong>{ok}</strong>
              </div>
            </div>
          )
        } else {
          showMessage(
            'warning',
            'Upload completed with issues',
            <div>
              <div>
                Uploaded: <strong>{ok}</strong>
              </div>
              {warn ? (
                <div>
                  Warnings: <strong>{warn}</strong>
                </div>
              ) : null}
              {err ? (
                <div>
                  Errors: <strong>{err}</strong>
                </div>
              ) : null}
            </div>
          )
        }
      } finally {
        isUploading = false
        updateFooter()
      }
    }

    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const container = e.currentTarget as HTMLElement
      container?.classList.remove('is-dragover')

      const files = Array.from(e.dataTransfer?.files || [])
      if (!files.length) return
      addFiles(files)
    }

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const container = e.currentTarget as HTMLElement
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
      container?.classList.add('is-dragover')
    }

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const container = e.currentTarget as HTMLElement
      container?.classList.remove('is-dragover')
    }

    const progressBar = (
      <div className="ipe-quickUpload__progress">
        <div className="ipe-quickUpload__progress-track">
          <div
            className="ipe-quickUpload__progress-fill"
            ref={(el: any) => {
              ui.progressEl = el
            }}
            style={{ width: '0%' }}
          />
        </div>
        <div className="ipe-quickUpload__progress-meta">
          <div
            className="ipe-quickUpload__muted"
            ref={(el: any) => {
              ui.progressTextEl = el
            }}
          >
            0/0 (0%)
          </div>
        </div>
      </div>
    ) as HTMLElement

    const leftPanel = (
      <section className="ipe-quickUpload__panel">
        <div className="ipe-input-box">
          <label htmlFor="mu_files">
            Files{' '}
            {items.length > 0 ? (
              <span className="ipe-quickUpload__count">({items.length} selected)</span>
            ) : null}
          </label>
          <input
            id="mu_files"
            type="file"
            multiple
            accept={String(accept || '')}
            disabled={isUploading}
            ref={(el: any) => {
              ui.fileInput = el
            }}
            onChange={(e: Event) => {
              const files = Array.from((e.target as HTMLInputElement).files || [])
              addFiles(files)
              ;(e.target as HTMLInputElement).value = ''
            }}
          />
        </div>

        <div
          ref={(el: any) => {
            ui.listEl = el
          }}
        />
      </section>
    ) as HTMLElement

    const rightPanel = (
      <section className="ipe-quickUpload__panel">
        <div
          className="ipe-quickUpload__preview"
          ref={(el: any) => {
            ui.previewWrapper = el
          }}
          onClick={(e) => {
            const target = e.target
            if (
              target &&
              (target as HTMLElement).closest('img, .ipe-quickUpload__preview-placeholder')
            ) {
              e.preventDefault()
              ui.fileInput?.click()
            }
          }}
        />
      </section>
    ) as HTMLElement

    const containerEl = (
      <section
        className="ipe-quickUpload__container"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {progressBar}
        <div className="ipe-quickUpload__layout">
          {leftPanel}
          {rightPanel}
        </div>

        <div className="ipe-quickUpload__footer">
          <div className="ipe-input-box">
            <label htmlFor="mu_summary">Summary (applies to all files)</label>
            <textarea
              id="mu_summary"
              disabled={isUploading}
              ref={(el: any) => {
                ui.summaryInput = el
              }}
              onInput={() => {}}
            />
          </div>

          <CheckBox
            name="ignorewarnings"
            label={$`Ignore warnings and upload anyway`}
            inputProps={{
              disabled: isUploading,
              ref: (el: any) => {
                ui.ignoreWarnings = el
              },
            }}
          />
        </div>
      </section>
    ) as HTMLElement

    modal.setContent(containerEl)

    if (ui.summaryInput) ui.summaryInput.value = String(defaultSummary || '')

    const updateFooter = () => {
      const { warn, err, paused } = countByStatus()
      const hasFailed = err > 0 || warn > 0
      const hasPaused = paused > 0

      let label = $`Upload`
      let action = () => void uploadAll('all')
      let className = 'is-primary is-text'

      if (isUploading) {
        label = pauseRequested ? 'Pausing...' : 'Pause after current'
        action = () => {
          pauseRequested = true
          updateFooter()
        }
      } else if (hasPaused) {
        label = 'Resume'
        action = () => void uploadAll('resume')
      } else if (hasFailed) {
        label = 'Retry failed/warnings'
        action = () => void uploadAll('retry')
      }

      modal.setButtons([
        {
          label: $`Cancel`,
          className: 'is-danger is-text',
          method: () => modal.close(),
        },
        {
          label: 'Reset',
          className: 'is-text',
          method: () => {
            if (isUploading) return
            resetAll()
          },
        },
        {
          label,
          className,
          method: action,
        },
      ])
    }

    void licensesPromise.then((data) => {
      if (!data) return
      licenseOptions = data.options
      licenseHeader = data.licenseHeader
      void renderPreview()
    })

    renderList()
    await renderPreview()

    return modal
  }
}
