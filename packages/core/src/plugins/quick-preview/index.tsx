import { Inject, InPageEdit, Schema } from '@/InPageEdit'
import { type QuickEditEventPayload } from '@/plugins/quick-edit'
import { IWikiPage } from '@/models/WikiPage'
import { MwApiParams } from 'wiki-saikou'
import { PageParseData } from '@/models/WikiPage/types/PageParseData'
import { IPEModal, IPEModalOptions } from '@inpageedit/modal'

import './style.scss'

interface QuickPreviewEventPayload {
  ctx: InPageEdit
  modal: IPEModal
  wikiPage: IWikiPage
  text: string
  parseData: PageParseData
}

declare module '@/InPageEdit' {
  interface InPageEdit {
    quickPreview: PluginQuickPreview & {
      // for backward compatibility
      (
        ...args: Parameters<PluginQuickPreview['previewWikitext']>
      ): ReturnType<PluginQuickPreview['previewWikitext']>
    }
  }
  interface Events {
    'quick-preview/show-modal'(payload: Omit<QuickPreviewEventPayload, 'parseData'>): void
    'quick-preview/loaded'(payload: QuickPreviewEventPayload): void
  }
  interface PreferencesMap {
    'quickPreview.keyshortcut.quickEdit': string
    'quickPreview.keyshortcut.quickDelete': string
  }
}

@Inject(['api', 'wikiPage', 'modal', 'preferences', '$'])
@RegisterPreferences(
  Schema.object({
    'quickPreview.keyshortcut': Schema.string()
      .default('ctrl-i')
      .description('Key shortcut to open quick preview in quick edit modal'),
  })
    .extra('category', 'editor')
    .description('Quick preview options')
)
export class PluginQuickPreview extends BasePlugin {
  constructor(public ctx: InPageEdit) {
    super(ctx, {}, 'quickPreview')
    this.ctx.set('quickPreview', makeCallable(this, 'previewWikitext'))
  }

  protected start(): Promise<void> | void {
    this.ctx.on('quick-edit/wiki-page', this.injectQuickEdit.bind(this))
  }

  protected stop(): Promise<void> | void {}

  previewWikitext(
    text: string,
    params?: MwApiParams,
    wikiPage?: IWikiPage,
    modal?: IPEModal,
    modalOptions?: Partial<IPEModalOptions>
  ) {
    const $ = this.ctx.$

    wikiPage ||= this.ctx.wikiPage.newBlankPage({
      title: 'API',
    })

    if (!modal || modal.isDestroyed) {
      modal = this.ctx.modal
        .createObject({
          className: 'in-page-edit ipe-quickPreview',
          sizeClass: 'large',
          center: false,
          ...modalOptions,
        })
        .init()
    }

    modal.show()
    modal.setTitle($`Preview - Loading...`)
    modal.setContent(<ProgressBar />)
    modal.bringToFront()
    this.ctx.emit('quick-preview/show-modal', {
      ctx: this.ctx,
      text,
      modal,
      wikiPage,
    })

    wikiPage
      .preview(text, params)
      .then((ret) => {
        const {
          data: { parse },
        } = ret
        modal.setTitle($(parse.title)`Preview - {{ $1 }}`)
        let outputRef: HTMLElement | null = null
        modal.setContent(
          (
            <section>
              <div
                ref={(el) => (outputRef = el)}
                className="mw-parser-output"
                innerHTML={parse.text}
              ></div>
            </section>
          ) as HTMLElement
        )
        if (window.mw?.hook && typeof jQuery === 'function') {
          window.mw.hook('wikipage.content').fire(jQuery(outputRef!))
        }
        this.ctx.emit('quick-preview/loaded', {
          ctx: this.ctx,
          modal,
          wikiPage,
          text,
          parseData: parse,
        })
      })
      .catch((error) => {
        modal.setTitle($`Preview - Failed`)
        modal.setContent(
          <>
            <p>{$`Failed to preview`}</p>
            <p>{error instanceof Error ? error.message : String(error)}</p>
          </>
        )
      })

    return modal
  }

  private async injectQuickEdit({ options, modal, wikiPage }: QuickEditEventPayload) {
    const $ = this.ctx.$
    let latestPreviewModal: IPEModal | undefined = undefined
    modal.addButton(
      {
        label: $`Preview`,
        side: 'left',
        className: 'btn btn-secondary',
        keyPress:
          (await this.ctx.preferences.get('quickPreview.keyshortcut.quickEdit')) || undefined,
        method: () => {
          let wikitext =
            (modal.get$content().querySelector<HTMLTextAreaElement>('textarea[name="text"]')
              ?.value as string) || ''
          if (options.section === 'new') {
            const title = modal
              .get$content()
              .querySelector<HTMLInputElement>('input[name="summary"]')?.value
            if (title) {
              wikitext = `==${title}==\n${wikitext}`
            }
          }

          latestPreviewModal = this.previewWikitext(
            wikitext,
            undefined,
            wikiPage,
            latestPreviewModal,
            {
              backdrop: false,
              draggable: true,
            }
          )
        },
      },
      1
    )
    modal.on(modal.Event.Close, () => {
      latestPreviewModal?.destroy()
      latestPreviewModal = undefined
    })
  }

  private _contentTypeCache = new Map<string, Promise<string>>()
  private fetchContentType(url: string) {
    const cached = this._contentTypeCache.get(url)
    if (cached) return cached
    const promise = fetch(url, { method: 'HEAD' })
      .then((res) => res.headers.get('content-type') || '')
      .catch(() => {
        this._contentTypeCache.delete(url)
        return ''
      })
    this._contentTypeCache.set(url, promise)
    return promise
  }
  async getPreviewType(fileOrUrl: File | string) {
    if (!fileOrUrl) return 'unknown'
    let contentType: string
    let ext: string
    if (fileOrUrl instanceof File) {
      contentType = fileOrUrl.type
      ext = fileOrUrl.name.split('.').pop()?.toLowerCase() || ''
    } else {
      const url = new URL(fileOrUrl, location.origin)
      if (url.protocol === 'data:' || url.protocol === 'blob:' || url.protocol.startsWith('http')) {
        contentType = await this.fetchContentType(url.href)
      } else {
        contentType = ''
      }
      ext = url.pathname.split('.').pop()?.toLowerCase() || ''
    }
    if (
      contentType.startsWith('image/') &&
      /** Windows provide PDFs as image/pdf */ !contentType.includes('pdf')
    ) {
      return 'image'
    }
    if (contentType.startsWith('video/')) return 'video'
    if (contentType.startsWith('audio/')) return 'audio'
    if (contentType.startsWith('text/html')) return 'html'
    if (ext === 'md') return 'markdown'
    if (contentType.startsWith('text/')) return 'text'
    // detect by file extension
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'ico', 'webp'].includes(ext)) return 'image'
    if (['mp4', 'webm', 'ogg', 'flv', 'avi', 'mov', 'wmv', 'mkv'].includes(ext)) return 'video'
    if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'].includes(ext)) return 'audio'
    if (['html', 'htm'].includes(ext)) return 'html'
    if (['json', 'yml', 'yaml', 'toml', 'py'].includes(ext)) return 'text'
    if (['pdf'].includes(ext)) return 'pdf'
    return 'unknown'
  }
  async previewFile(fileOrUrl: File | string, alt?: string) {
    const previewElement = await this.getPreviewElement(fileOrUrl, alt)
    if (!previewElement) return
    const modal = this.ctx.modal.dialog({
      className: 'in-page-edit ipe-quickPreview',
      sizeClass: 'mediumToLarge',
      center: true,
      title: alt ?? (fileOrUrl instanceof File ? fileOrUrl.name : fileOrUrl),
      content: <section className="ipe-quickPreview__content">{previewElement}</section>,
    })
    return modal
  }
  private _objectUrls = new WeakMap<File, string>()
  private getObjectUrl(file: File) {
    if (!this._objectUrls.has(file)) {
      const objUrl = URL.createObjectURL(file)
      this._objectUrls.set(file, objUrl)
    }
    return this._objectUrls.get(file)!
  }
  async getPreviewElement(fileOrUrl: File | string, alt?: string) {
    const previewType = await this.getPreviewType(fileOrUrl)
    const url = fileOrUrl instanceof File ? this.getObjectUrl(fileOrUrl) : fileOrUrl
    switch (previewType) {
      case 'image':
        return (
          <img src={url} alt={alt ?? (fileOrUrl instanceof File ? fileOrUrl.name : fileOrUrl)} />
        )
      case 'video':
        return <video src={url} controls={true} aria-label={alt} />
      case 'audio':
        return <audio src={url} controls={true} aria-label={alt} />
      case 'pdf':
        return <embed type="application/pdf" src={url} aria-label={alt} />
    }
    return null
  }

  previewWikiPage(title: string) {
    throw new Error('Not implemented')
  }
}
