import { Inject, InPageEdit } from '@/InPageEdit'
import { type QuickEditInitPayload } from '@/plugins/quick-edit'
import { WikiPage } from '@/models/WikiPage'
import { MwApiParams } from 'wiki-saikou'
import { PageParseData } from '@/models/WikiPage/types/PageParseData'
import { IPEModal } from '@/services/ModalService/IPEModal.js'

declare module '@/InPageEdit' {
  interface InPageEdit {
    quickPreview: PluginQuickPreview['quickPreview']
  }
  interface Events {
    'quickPreview/showModal'(payload: {
      ctx: InPageEdit
      text: string
      modal: IPEModal
      wikiPage: WikiPage
    }): void
    'quickPreview/loaded'(payload: {
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
  }

  protected start(): Promise<void> | void {
    this.ctx.set('quickPreview', this.quickPreview.bind(this))
    this.ctx.on('quickEdit/wikiPage', this.injectQuickEdit.bind(this))
  }

  protected stop(): Promise<void> | void {
    this.ctx.off('quickEdit/wikiPage', this.injectQuickEdit.bind(this))
  }

  private injectQuickEdit({ ctx, modal, wikiPage }: QuickEditInitPayload) {
    modal.addButton(
      {
        label: 'Preview',
        side: 'left',
        className: 'btn btn-secondary',
        method: () => {
          this.quickPreview(
            (modal.get$content().querySelector<HTMLTextAreaElement>('textarea[name="text"]')
              ?.value as string) || '',
            undefined,
            wikiPage
          )
        },
      },
      2
    )
  }

  async quickPreview(text: string, params?: MwApiParams, wikiPage?: WikiPage) {
    wikiPage ||= this.ctx.wikiPage.newBlankPage({
      title: 'API',
    })

    const modal = this.ctx.modal
      .createObject({
        className: 'in-page-edit ipe-quickPreview',
        sizeClass: 'large',
      })
      .init()
    modal.setTitle('Preview loading...')
    modal.setContent(
      (
        <section>
          <ProgressBar />
        </section>
      ) as HTMLElement
    )
    modal.show()
    this.ctx.emit('quickPreview/showModal', {
      ctx: this.ctx,
      text,
      modal,
      wikiPage,
    })

    const {
      data: { parse },
    } = await wikiPage.preview(text, params)
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
    this.ctx.emit('quickPreview/loaded', {
      ctx: this.ctx,
      modal,
      wikiPage,
      text,
      parseData: parse,
    })
  }
}
