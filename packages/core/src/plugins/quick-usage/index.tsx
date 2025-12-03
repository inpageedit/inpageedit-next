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
    this.ctx.plugin(
      await import('./PluginTemplatesUsed.js').then(
        ({ PluginTemplatesUsed }) => PluginTemplatesUsed
      )
    )
    this.ctx.plugin(
      await import('./PluginImagesUsed.js').then(({ PluginImagesUsed }) => PluginImagesUsed)
    )
  }
  getWrapperForQuickEdit(modal: IPEModal) {
    const wrapper = modal.get$content().querySelector('.ipe-quickEdit__usages') || (
      <div
        className="ipe-quickEdit__usages"
        style={{ display: 'flex', gap: '1em', flexWrap: true }}
      ></div>
    )
    modal
      .get$content()
      .querySelector('.ipe-quickEdit__content')
      ?.insertAdjacentElement('afterend', wrapper)
    return wrapper
  }
}
