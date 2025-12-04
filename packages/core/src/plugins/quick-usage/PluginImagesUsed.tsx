import { Inject, InPageEdit } from '@/InPageEdit'
import { IWikiPage } from '@/models/index.js'
import { QuickEditEventPayload } from '../quick-edit/index.js'

declare module '@/InPageEdit' {
  interface InPageEdit {
    imagesUsed: PluginImagesUsed
  }
}

export interface PluginTemplatesUsedOptions {
  wikiPage?: IWikiPage
  title?: string
  pageId?: number
  revision?: number
}

@Inject(['modal', '$'])
export class PluginImagesUsed extends BasePlugin {
  constructor(public ctx: InPageEdit) {
    super(ctx, {}, 'images-used')
  }

  protected async start() {
    this.ctx.on('quick-edit/wiki-page', this.injectQuickEdit.bind(this))
  }

  injectQuickEdit(payload: QuickEditEventPayload) {
    const $ = this.ctx.$
    const { wikiPage, modal } = payload
    if (!wikiPage || !wikiPage.pageid) return
    const wrapper = this.ctx.quickUsage.getWrapperForQuickEdit(modal)
    const link = (
      <a
        href={`#ipe://quick-usage/images?title=${wikiPage.title}`}
        onClick={async (e) => {
          e.preventDefault()
          const usageModal = await this.showModal({ wikiPage })
          if (usageModal) {
            modal.on(modal.Event.Close, () => {
              usageModal.destroy()
            })
          }
        }}
      >{$`Images Used`}</a>
    )
    wrapper.appendChild(link)
  }

  async showModal(options: PluginTemplatesUsedOptions = {}) {
    const $ = this.ctx.$

    const wikiPage = options.wikiPage || (await this.ctx.wikiPage.WikiPage.newFromAnyKind(options))
    if (!wikiPage || !wikiPage.pageid) return

    const modal = this.ctx.modal.show({
      title: $`Images Used`,
      content: (
        <section className="ipe-quickUsage__images">
          <ol>
            {wikiPage.images.map((image) => {
              const src = this.ctx.wikiFile.getFileUrl(image.title)
              return (
                <li key={image.title}>
                  <a
                    href={this.ctx.wiki.getUrl(image.title)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {image.title}
                  </a>{' '}
                  (
                  <a
                    href={src}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      e.preventDefault()
                      this.ctx.quickPreview.previewFile(src, image.title)
                    }}
                  >{$`Preview`}</a>
                  )
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
