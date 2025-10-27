import { Inject, InPageEdit } from '@/InPageEdit'
import { interpolate } from '@/utils/interpolate.js'
;(window as any).interpolate = interpolate

@Inject(['modal', 'toolbox', 'wiki'])
class PluginDebug extends BasePlugin {
  constructor(public ctx: InPageEdit) {
    super(ctx, {}, 'debug')
  }

  protected async start() {
    this.ctx.toolbox.addButton({
      id: '_debug',
      icon: '🐞',
      tooltip: 'debug',
      group: 'group2',
      onClick: () => {
        this.showModal()
      },
    })
  }

  showModal() {
    const modal = this.ctx.modal
      .createObject({
        title: 'Debug Info',
        content: (
          <div>
            <h2>Site Metadata</h2>
            <pre style={{ maxHeight: '20em', overflow: 'auto' }}>
              {JSON.stringify(this.ctx.wiki._raw, null, 2)}
            </pre>
            <h2>Current Page</h2>
            <pre style={{ maxHeight: '20em', overflow: 'auto' }}>
              {JSON.stringify(this.ctx.currentPage.wikiTitle, null, 2)}
            </pre>
          </div>
        ),
      })
      .init()

    return modal.show()
  }
}

export default PluginDebug
