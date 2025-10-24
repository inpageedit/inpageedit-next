import { Inject, InPageEdit } from '@/InPageEdit'
import { createApp } from 'vue'
import PreferencesForm from './PreferencesForm.vue'
import { injectIPE } from '@/utils/vueHooks'

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
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="currentColor"
            class="icon icon-tabler icons-tabler-filled icon-tabler-settings"
          >
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M14.647 4.081a.724 .724 0 0 0 1.08 .448c2.439 -1.485 5.23 1.305 3.745 3.744a.724 .724 0 0 0 .447 1.08c2.775 .673 2.775 4.62 0 5.294a.724 .724 0 0 0 -.448 1.08c1.485 2.439 -1.305 5.23 -3.744 3.745a.724 .724 0 0 0 -1.08 .447c-.673 2.775 -4.62 2.775 -5.294 0a.724 .724 0 0 0 -1.08 -.448c-2.439 1.485 -5.23 -1.305 -3.745 -3.744a.724 .724 0 0 0 -.447 -1.08c-2.775 -.673 -2.775 -4.62 0 -5.294a.724 .724 0 0 0 .448 -1.08c-1.485 -2.439 1.305 -5.23 3.744 -3.745a.722 .722 0 0 0 1.08 -.447c.673 -2.775 4.62 -2.775 5.294 0zm-2.647 4.919a3 3 0 1 0 0 6a3 3 0 0 0 0 -6z" />
          </svg>
        ) as HTMLElement,
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
      className: 'ipe-preference compact-buttons',
      sizeClass: 'small',
      outSideClose: false,
      center: true,
      title: 'InPageEdit Preferences',
      content: (
        <>
          <ProgressBar />
        </>
      ) as HTMLElement,
    })

    modal.get$window().classList.add('dialog')

    const root = <div id="ipe-preferences-app" style={{ minHeight: '65vh' }}></div>
    modal.setContent(root as HTMLElement)

    const app = this.createFormApp()
    const form = app.mount(root) as InstanceType<typeof PreferencesForm>

    modal.setButtons([
      {
        label: 'Cancel',
        className: 'is-danger is-ghost',
        method: () => {
          modal.close()
        },
      },
      {
        label: 'Save',
        className: 'is-primary is-ghost',
        method: () => {
          const value = form.getValue()
          this.logger.info('saving preferences', value)
          try {
            Object.entries(value).forEach(([key, val]) => {
              this.ctx.preferences.set(key, val).catch(console.error)
            })
          } catch (error) {
            this.logger.error('failed to save preferences', error)
          }
          modal.close()
          this.ctx.modal.notify('success', {
            title: 'Preferences Saved',
            content: <p>Some settings may take effect after reloading the page.</p>,
          })
        },
      },
    ])

    modal.on(modal.Event.Close, () => {
      this.logger.debug('preferences modal closed, vue app unmounting')
      app.unmount()
    })
  }

  createFormApp() {
    const app = createApp(PreferencesForm)
    injectIPE(this.ctx, app)
    return app
  }
}
