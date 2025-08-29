import { InPageEdit } from '@/InPageEdit'

export class PluginQuickRename extends BasePlugin {
  static readonly inject = ['api', 'wikiPage', 'modal']

  constructor(public ctx: InPageEdit) {
    super(ctx, {}, 'quick-rename')
  }

  protected start(): Promise<void> | void {
    this.ctx.inject(['toolbox'], (ctx) => {
      this.ctx = ctx
      ctx.toolbox.addButton({
        id: 'quickMoveFrom',
        icon: 'MFr',
        tooltip: 'Move From',
        group: 'group2',
        onClick: () => {
          // Handle move from action
        },
      })
      ctx.toolbox.addButton({
        id: 'quickMoveTo',
        icon: 'MTo',
        tooltip: 'Move To',
        group: 'group2',
        onClick: () => {
          // Handle move to action
        },
      })
      this.addDisposeHandler((ctx) => {
        ctx.toolbox.removeButton('quickMoveFrom')
        ctx.toolbox.removeButton('quickMoveTo')
      })
    })
  }

  protected stop(): Promise<void> | void {}
}
