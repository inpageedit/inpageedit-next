import { Inject, InPageEdit } from '@/InPageEdit'

@Inject(['modal', 'toolbox', 'sitemeta'])
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
              {JSON.stringify(this.ctx.sitemeta._raw, null, 2)}
            </pre>
            <h2>MBox</h2>
            {['note', 'tip', 'important', 'warning', 'caution'].map((type, index) => (
              <MBox type={type as any} closeable={index % 2 === 0}>
                {type[0].toUpperCase() + type.slice(1).toLowerCase()} box
              </MBox>
            ))}
          </div>
        ) as HTMLElement,
      })
      .init()

    return modal.show()
  }
}

export default PluginDebug
