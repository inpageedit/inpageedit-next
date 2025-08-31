import { Inject, InPageEdit, Schema } from '@/InPageEdit'
import { createApp, h } from 'vue'
import PreferencesUI from './components/PreferencesUI.vue'
import { IPEInjectKey } from './components/hooks'

declare module '@/InPageEdit' {
  export interface InPageEdit {
    preferencesUI: PluginPreferencesUI
  }
}

@Inject(['preferences', 'modal'])
export class PluginPreferencesUI extends BasePlugin {
  constructor(public ctx: InPageEdit) {
    super(ctx, {}, 'preferences-ui')
    ctx.set('preferencesUI', this)
    ctx.inject(['toolbox'], (ctx) => {
      ctx.toolbox.addButton({
        id: 'preferences',
        icon: 'cog',
        tooltip: 'Open preferences',
        group: 'group2',
        index: Infinity,
        onClick: () => this.showModal(),
      })
      this.addDisposeHandler(() => {
        ctx.toolbox.removeButton('preferences')
      })
    })
  }

  showModal() {
    const modal = this.ctx.modal.show({
      className: 'in-page-edit',
      sizeClass: 'medium',
      outSideClose: false,
      center: true,
      title: 'InPageEdit Prefrences',
      content: (
        <>
          <ProgressBar />
        </>
      ) as HTMLElement,
      onClose() {
        app.unmount()
      },
    })

    modal.get$wrapper().addClass('dialog')

    const root = <div id="ipe-preferences-app" style={{ minHeight: '65vh' }}></div>
    modal.setContent(root as HTMLElement)

    const app = createApp(PreferencesUI)
    app.provide(IPEInjectKey, this.ctx)
    const ui = app.mount(root) as InstanceType<typeof PreferencesUI>

    modal.setButtons([
      {
        label: 'Save',
        className: 'btn',
        method: () => {
          const value = ui.getValue()
          Object.entries(value).forEach(([key, val]) => {
            this.ctx.preferences.set(key, val).catch(console.error)
          })
          modal.close()
        },
      },
      {
        label: 'Cancel',
        className: 'btn btn-danger',
        method: () => {
          modal.close()
        },
      },
    ])
  }
}
