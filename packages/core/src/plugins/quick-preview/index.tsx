import { Inject, InPageEdit, Schema } from '@/InPageEdit'
import { type QuickEditEventPayload } from '@/plugins/quick-edit'
import { IWikiPage } from '@/models/WikiPage'
import { MwApiParams } from 'wiki-saikou'
import { PageParseData } from '@/models/WikiPage/types/PageParseData'
import { IPEModal, IPEModalOptions } from '@inpageedit/modal'
import { QuickDeleteInitPayload } from '../quick-delete/index.js'

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

@Inject(['api', 'wikiPage', 'modal', 'preferences'])
@RegisterPreferences(
  Schema.object({
    'quickPreview.keyshortcut': Schema.string()
      .default('ctrl-p')
      .description('Key shortcut to open quick preview in quick edit modal'),
  })
    .extra('category', 'edit')
    .description('Quick preview options')
)
export class PluginQuickPreview extends BasePlugin {
  constructor(public ctx: InPageEdit) {
    super(ctx, {}, 'quickPreview')
    this.ctx.set('quickPreview', makeCallable(this, 'previewWikitext'))
  }

  protected start(): Promise<void> | void {
    this.ctx.on('quick-edit/wiki-page', this.injectQuickEdit.bind(this))
    this.ctx.on('quick-delete/wiki-page', this.injectQuickDelete.bind(this))
  }

  protected stop(): Promise<void> | void {}

  previewWikitext(
    text: string,
    params?: MwApiParams,
    wikiPage?: IWikiPage,
    modal?: IPEModal,
    modalOptions?: Partial<IPEModalOptions>
  ) {
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

  private async injectQuickEdit({ options, modal, wikiPage }: QuickEditEventPayload) {
    let latestPreviewModal: IPEModal | undefined = undefined
    modal.addButton(
      {
        label: 'Preview',
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
