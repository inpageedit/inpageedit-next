import { Inject, InPageEdit } from '@/InPageEdit'
import { type QuickEditInitPayload } from '@/plugins/quick-edit'
import { WikiPage } from '@/models/WikiPage'
import { MwApiParams } from 'wiki-saikou'
import { PageParseData } from '@/models/WikiPage/types/PageParseData'
import { IPEModal } from '@/services/ModalService/IPEModal.js'
import { QuickDeleteInitPayload } from '../quick-delete/index.js'

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
    'quick-preview/show-modal'(payload: {
      ctx: InPageEdit
      text: string
      modal: IPEModal
      wikiPage: WikiPage
    }): void
    'quick-preview/loaded'(payload: {
      ctx: InPageEdit
      modal: IPEModal
      wikiPage: WikiPage
      text: string
      parseData: PageParseData
    }): void
  }
}

@Inject(['api', 'wikiPage', 'modal'])
export class PluginQuickPreview extends BasePlugin {
  constructor(public ctx: InPageEdit) {
    super(ctx, {}, 'quickPreview')
    this.ctx.set('quickPreview', makeCallable(this, 'previewWikitext'))
  }

  protected start(): Promise<void> | void {
    this.ctx.on('quick-edit/wiki-page', this.injectQuickEdit.bind(this))
    this.ctx.on('quick-delete/wiki-page', this.injectQuickDelete.bind(this))
  }

  protected stop(): Promise<void> | void {
    this.ctx.off('quick-edit/wiki-page', this.injectQuickEdit.bind(this))
    this.ctx.off('quick-delete/wiki-page', this.injectQuickDelete.bind(this))
  }

  previewWikitext(text: string, params?: MwApiParams, wikiPage?: WikiPage, modal?: IPEModal) {
    wikiPage ||= this.ctx.wikiPage.newBlankPage({
      title: 'API',
    })

    if (!modal || modal.isDestroyed) {
      modal = this.ctx.modal
        .createObject({
          className: 'in-page-edit ipe-quickPreview',
          sizeClass: 'large',
          backdrop: false,
          draggable: true,
        })
        .init()
    }

    modal.show()
    modal.setTitle('Preview - Loading...')
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
        modal.setTitle(`Preview - ${parse.title}`)
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
        window.mw?.hook('wikipage.content').fire($(outputRef!))
        this.ctx.emit('quick-preview/loaded', {
          ctx: this.ctx,
          modal,
          wikiPage,
          text,
          parseData: parse,
        })
      })
      .catch((error) => {
        modal.setTitle('Preview - Failed')
        modal.setContent(
          <>
            <p>Failed to preview</p>
            <p>{error instanceof Error ? error.message : String(error)}</p>
          </>
        )
      })

    return modal
  }

  private injectQuickEdit({ ctx, modal, wikiPage }: QuickEditInitPayload) {
    let latestPreviewModal: IPEModal | undefined = undefined
    modal.addButton(
      {
        label: 'Preview',
        side: 'left',
        className: 'btn btn-secondary',
        method: () => {
          latestPreviewModal = this.previewWikitext(
            (modal.get$content().querySelector<HTMLTextAreaElement>('textarea[name="text"]')
              ?.value as string) || '',
            undefined,
            wikiPage,
            latestPreviewModal
          )
        },
      },
      2
    )
  }

  private injectQuickDelete({ ctx, modal, wikiPage }: QuickDeleteInitPayload) {
    modal.addButton(
      {
        label: 'Preview',
        side: 'left',
        className: 'btn btn-secondary',
        method: () => {
          this.logger.warn('To be implemented: preview wikitext for quick delete')
        },
      },
      2
    )
  }
}
