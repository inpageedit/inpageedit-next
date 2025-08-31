import { Inject, InPageEdit } from '@/InPageEdit'
import { type QuickEditInitPayload } from '@/plugins/quick-edit'
import { WikiPage } from '@/models/WikiPage'
import { MwApiParams } from 'wiki-saikou'
import { SsiModal } from '@/types/SsiModal'
import { PageParseData } from '@/models/WikiPage/types/PageParseData'

declare module '@/InPageEdit' {
  interface InPageEdit {
    quickPreview: PluginQuickPreview['quickPreview']
  }
  interface Events {
    'quickPreview/showModal'(payload: {
      ctx: InPageEdit
      text: string
      modal: SsiModal
      wikiPage: WikiPage
    }): void
    'quickPreview/loaded'(payload: {
      ctx: InPageEdit
      modal: SsiModal
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

  injectQuickEdit({ ctx, modal, wikiPage }: QuickEditInitPayload) {
    modal.setButtons([
      {
        label: 'Preview',
        side: 'left',
        className: 'btn btn-secondary',
        method: () => {
          this.quickPreview(
            (modal.get$content().find('textarea.editArea').val() as string) || '',
            undefined,
            wikiPage
          )
        },
      },
    ])
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
    modal.setContent(
      (
        <section>
          <div className="mw-parser-output" innerHTML={parse.text}></div>
        </section>
      ) as HTMLElement
    )
    this.ctx.emit('quickPreview/loaded', {
      ctx: this.ctx,
      modal,
      wikiPage,
      text,
      parseData: parse,
    })
  }
}
