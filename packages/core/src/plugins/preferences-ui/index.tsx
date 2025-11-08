import { Inject, InPageEdit, Schema } from '@/InPageEdit'
import PreferencesForm from './PreferencesForm.vue'
import { CustomIPEModal } from '@/services/ModalService.js'
import type { App as VueApp } from 'vue'

declare module '@/InPageEdit' {
  export interface InPageEdit {
    preferencesUI: PluginPreferencesUI
    // Alias
    prefsModal: PluginPreferencesUI
  }
  export interface Events {
    'preferences-ui/modal-shown'(payload: { ctx: InPageEdit; modal: CustomIPEModal }): void
    'preferences-ui/vue-app-mounted'(payload: {
      ctx: InPageEdit
      app: VueApp
      form: InstanceType<typeof PreferencesForm>
    }): void
    'preferences-ui/modal-tab-changed'(payload: {
      ctx: InPageEdit
      category: string
      $tabContent: HTMLElement
    }): void
    'preferences-ui/form-data-saved'(payload: {
      ctx: InPageEdit
      data: Record<string, unknown>
    }): void
    'preferences-ui/modal-closed'(payload: { ctx: InPageEdit; modal: CustomIPEModal }): void
  }
}

@Inject(['preferences', 'modal'])
export class PluginPreferencesUI extends BasePlugin {
  constructor(public ctx: InPageEdit) {
    super(ctx, {}, 'preferences-ui')
    ctx.set('preferencesUI', this)
    ctx.set('prefsModal', this)

    ctx.preferences.defineCategory({
      name: 'about',
      label: 'About',
      description: 'About InPageEdit',
      index: 99,
    })

    ctx.preferences.registerCustomConfig(
      'about',
      Schema.object({
        about: Schema.const(
          <div className="prose">
            <h2>✏️ InPageEdit NEXT</h2>
            <i>v{this.ctx.version}</i>
            <h2>Portals</h2>
            <div style="display: grid; gap: 0.5em; text-align: center">
              <a
                className="btn primary"
                style={{ display: 'inline-block', textDecoration: 'none' }}
                href={this.ctx.Endpoints.HOME_URL}
                target="_blank"
              >
                Official Website & Help Center
              </a>
              <a
                className="btn primary"
                style={{ display: 'inline-block', textDecoration: 'none' }}
                href={`${this.ctx.Endpoints.UPDATE_LOGS_URL}#${this.ctx.version.split('-')[0]}`}
                target="_blank"
              >
                Update Logs
              </a>
            </div>
            <h2>Join us</h2>
            <ul>
              <li>
                <strong>GitHub</strong>:{' '}
                <a href={this.ctx.Endpoints.GITHUB_URL} target="_blank">
                  inpageedit/inpageedit-next
                </a>
              </li>
              <li>
                <strong>QQ Group</strong>: 1026023666
              </li>
            </ul>
            <hr />
            <p>🚀 Modular, Extensible Supercharged Plugin for MediaWiki.</p>
            <p>InPageEdit-NEXT Copyright © 2025-present dragon-fish</p>
          </div>
        ).role('raw-html'),
      }).description(''),
      'about'
    )

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
        tooltip: 'Configure Preferences',
        group: 'group2',
        index: 99,
        onClick: () => this.showModal(),
      })

      this.addDisposeHandler((ctx) => {
        ctx.toolbox.removeButton('preferences')
      })
    })
  }

  protected async start(): Promise<void> {
    // TODO: 不要硬编码……
    import('./PluginPrefSync.js')
      .then(({ PluginPrefSync }) => {
        this.ctx.plugin(PluginPrefSync)
      })
      .catch(this.ctx.logger.warn)

    this.ctx.on('preferences/changed', (payload) => {
      this._form?.mergeValue?.(payload.input)
    })
  }

  protected stop(): Promise<void> | void {}

  _latestModal: CustomIPEModal | null = null
  _form: InstanceType<typeof PreferencesForm> | null = null
  showModal() {
    if (this._latestModal && !this._latestModal.isDestroyed) {
      return this._latestModal
    }
    const modal = this.ctx.modal.show({
      className: 'ipe-preference compact-buttons',
      sizeClass: 'small',
      outSideClose: false,
      center: true,
      title: `InPageEdit Preferences (${this.ctx.version})`,
      content: (
        <>
          <ProgressBar />
        </>
      ) as HTMLElement,
    })

    modal.get$window().classList.add('dialog')

    const root = <div id="ipe-preferences-app" style={{ minHeight: '65vh' }}></div>
    modal.setContent(root as HTMLElement)

    this.ctx.emit('preferences-ui/modal-shown', {
      ctx: this.ctx,
      modal,
    })

    const app = this.createForm()
    const form = app.mount(root) as InstanceType<typeof PreferencesForm>
    this._form = form

    this.ctx.emit('preferences-ui/vue-app-mounted', {
      ctx: this.ctx,
      app,
      form,
    })

    modal.setButtons([
      {
        label: 'Close',
        className: 'is-ghost',
        method: () => {
          modal.close()
        },
      },
      {
        label: 'Save',
        className: 'is-primary is-ghost',
        method: async () => {
          const value = form.getValue()
          try {
            const ret = await this.ctx.preferences.setMany(value)
            this.logger.info('preferences saved', value, ret)
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

    this._latestModal = modal

    modal.on(modal.Event.Close, () => {
      this.logger.debug('preferences modal closed, vue app unmounting')
      app.unmount()
      this._latestModal = null
      this._form = null

      this.ctx.emit('preferences-ui/modal-closed', {
        ctx: this.ctx,
        modal,
      })
    })

    return modal
  }
  closeModal() {
    this._latestModal?.close()
  }
  getExistingModal() {
    return this._latestModal
  }
  async saveFormData() {
    const value = this._form?.getValue()
    if (!value) {
      return false
    }
    this.ctx.preferences.setMany(value)
    return true
  }
  getExistingFormValue() {
    return this._form?.getValue()
  }
  mergeToExistingForm(value: Record<string, unknown>) {
    this._form?.mergeValue?.(value)
  }

  createForm() {
    return createVueAppWithIPE(this.ctx, PreferencesForm)
  }
}
