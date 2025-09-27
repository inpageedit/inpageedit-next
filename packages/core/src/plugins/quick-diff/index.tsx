import { InPageEdit } from '@/InPageEdit'
import { JsDiffService } from './JsDiffService'
import { PluginQuickDiffCore } from './PluginQuickDiffCore'

export class PluginQuickDiff extends BasePlugin {
  static readonly inject = ['api', 'wikiPage', 'modal']

  constructor(public ctx: InPageEdit) {
    super(ctx, {}, 'quick-diff-loader')
    ctx.plugin(JsDiffService)
    ctx.plugin(PluginQuickDiffCore)
  }
}
