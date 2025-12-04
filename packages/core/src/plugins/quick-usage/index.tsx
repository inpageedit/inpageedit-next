import { InPageEdit } from '@/InPageEdit'
import { IPEModal } from '@inpageedit/modal'

declare module '@/InPageEdit' {
  interface InPageEdit {
    quickUsage: PluginQuickUsage
  }
}

export class PluginQuickUsage extends BasePlugin {
  constructor(public ctx: InPageEdit) {
    super(ctx, {}, 'quick-usage')
    ctx.set('quickUsage', this)
  }
  protected async start() {
    import('./PluginTemplatesUsed.js').then(({ PluginTemplatesUsed }) =>
      this.ctx.plugin(PluginTemplatesUsed)
    )
    import('./PluginImagesUsed.js').then(({ PluginImagesUsed }) =>
      this.ctx.plugin(PluginImagesUsed)
    )
    this.ctx.inject(['quickUpload', '$'], (ctx) => {
      ctx.on('quick-edit/wiki-page', ({ modal }) => {
        const { $ } = ctx
        const wrapper = this.getWrapperForQuickEdit(modal)
        wrapper.appendChild(
          <a
            href="#ipe:quick-upload"
            onClick={(e) => {
              e.preventDefault()
              ctx.quickUpload.showModal()
              ctx.emit('analytics/event', { feature: 'quick-usage', subtype: 'quick-upload' })
            }}
          >{$`Quick Upload`}</a>
        )
      })
    })
  }
  getWrapperForQuickEdit(modal: IPEModal) {
    const wrapper = modal.get$content().querySelector('.ipe-quickEdit__usages') || (
      <div
        className="ipe-quickEdit__usages"
        style={{ display: 'flex', gap: '1em', flexWrap: 'wrap' }}
      ></div>
    )
    modal
      .get$content()
      .querySelector('.ipe-quickEdit__content')
      ?.insertAdjacentElement('afterend', wrapper)
    return wrapper
  }
}
