import { Inject, InPageEdit } from '@/InPageEdit'

@Inject(['toolbox', 'modal'])
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
