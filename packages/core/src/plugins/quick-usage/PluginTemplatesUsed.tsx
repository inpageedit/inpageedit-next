import { Inject, InPageEdit } from '@/InPageEdit'
import { IWikiPage } from '@/models/index.js'
import { QuickEditEventPayload } from '../quick-edit/index.js'

declare module '@/InPageEdit' {
  interface InPageEdit {
    templatesUsed: PluginTemplatesUsed
  }
}

export interface PluginTemplatesUsedOptions {
  wikiPage?: IWikiPage
  title?: string
  pageId?: number
  revision?: number
}

@Inject(['modal', '$'])
export class PluginTemplatesUsed extends BasePlugin {
  constructor(public ctx: InPageEdit) {
    super(ctx, {}, 'templates-used')
    ctx.set('templatesUsed', this)
  }

  protected async start() {
    this.ctx.on('quick-edit/wiki-page', this._injectQuickEdit.bind(this))
  }

  private _injectQuickEdit(payload: QuickEditEventPayload) {
    const $ = this.ctx.$
    const { wikiPage, modal } = payload
    const wrapper = this.ctx.quickUsage.getWrapperForQuickEdit(modal)
    const link = (
      <a
        href={`#ipe://quick-usage/templates?title=${wikiPage.title}`}
        onClick={async (e) => {
          e.preventDefault()
          const usageModal = await this.showModal({ wikiPage })
          if (usageModal) {
            modal.on(modal.Event.Close, () => {
              usageModal.destroy()
            })
          }
        }}
      >{$`Templates Used`}</a>
    )
    wrapper.appendChild(link)
  }

  async showModal(options: PluginTemplatesUsedOptions = {}) {
    const $ = this.ctx.$

    const wikiPage = options.wikiPage || (await this.ctx.wikiPage.WikiPage.newFromAnyKind(options))
    if (!wikiPage || !wikiPage.pageid) return

    const modal = this.ctx.modal.show({
      title: $`Templates Used`,
      content: (
        <section className="ipe-quickUsage__templates">
          <ol>
            {wikiPage.templates.map((template) => {
              const title = this.ctx.wikiTitle.newTitle(template.title, template.ns)
              const quickEditButton = this.ctx.quickEdit.createQuickEditButton(
                {
                  title: title.toString(),
                },
                { label: '' }
              )
              return (
                <li key={title.toString()}>
                  <a href={title.getURL().toString()} target="_blank" rel="noopener noreferrer">
                    {title.toString()}
                  </a>{' '}
                  ({quickEditButton})
                </li>
              )
            })}
          </ol>
        </section>
      ),
      sizeClass: 'dialog',
      draggable: true,
      backdrop: false,
    })

    return modal
  }
}
