import { InPageEdit, Schema } from '@/InPageEdit'
import { IPEModal } from '@inpageedit/modal'

declare module '@/InPageEdit' {
  interface InPageEdit {
    quickRedirect: PluginQuickRedirect
  }
  interface Events {
    'quick-redirect/init-options'(payload: {
      ctx: InPageEdit
      options: Partial<QuickRedirectOptions>
    }): void
    'quick-redirect/show-modal'(payload: { ctx: InPageEdit; modal: IPEModal }): void
    'quick-redirect/submit'(payload: { ctx: InPageEdit; payload: RedirectPageOptions }): void
  }
  interface PreferencesMap {
    'quickRedirect.reason': string
  }
}

export interface RedirectPageOptions {
  from: string
  to: string
  reason?: string
  overwrite?: boolean
}
export interface QuickRedirectOptions extends Partial<RedirectPageOptions> {}

export class PluginQuickRedirect extends BasePlugin {
  static readonly inject = ['api', 'wikiPage', 'modal', '$']
  static readonly PreferencesSchema = Schema.object({
    'quickRedirect.reason': Schema.string().default('[IPE-NEXT] Quick redirect'),
  })
    .description('Quick redirect options')
    .extra('category', 'editor')

  constructor(public ctx: InPageEdit) {
    super(ctx, {}, 'quick-redirect')
  }

  protected start(): Promise<void> | void {
    this.ctx.set('quickRedirect', this)
    const $ = this.ctx.$

    const curPageName = window.mw?.config.get('wgPageName') || ''
    const canEdit = window.mw?.config.get('wgIsProbablyEditable')
    this.ctx.inject(['toolbox'], (ctx) => {
      this.ctx = ctx
      ctx.toolbox.addButton({
        id: 'quick-redirect',
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="icon icon-tabler icons-tabler-outline icon-tabler-file-symlink"
          >
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M4 21v-4a3 3 0 0 1 3 -3h5" />
            <path d="M9 17l3 -3l-3 -3" />
            <path d="M14 3v4a1 1 0 0 0 1 1h4" />
            <path d="M5 11v-6a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2h-9.5" />
          </svg>
        ) as HTMLElement,
        tooltip: () => $`Quick Redirect`,
        group: 'group1',
        index: 2,
        onClick: () => {
          this.showModal(
            canEdit
              ? {
                  to: curPageName,
                }
              : {}
          )
        },
      })
      this.addDisposeHandler((ctx) => {
        ctx.toolbox.removeButton('quick-redirect')
      })
    })
  }

  protected stop(): Promise<void> | void {}

  async showModal(options?: Partial<QuickRedirectOptions>) {
    const $ = this.ctx.$
    const reason = await this.ctx.preferences.get('quickRedirect.reason')
    if (!options) {
      options = {}
    }
    this.ctx.emit('quick-redirect/init-options', { ctx: this.ctx, options })
    const modal = this.ctx.modal
      .createObject({
        title: $`Quick Redirect`,
        content: (<ProgressBar />) as HTMLElement,
        className: 'quick-redirect compact-buttons',
        sizeClass: 'smallToMedium',
        center: true,
      })
      .init()

    let formRef: HTMLFormElement | null = null
    modal.setContent(
      (
        <form
          ref={(el) => (formRef = el)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
          onSubmit={(e) => {
            e.preventDefault()
            formRef?.checkValidity()
            if (!formRef?.reportValidity()) {
              return
            }
            const formData = new FormData(formRef!)
            const options = {
              from: formData.get('from')?.toString().trim()!,
              to: formData.get('to')?.toString().trim()!,
              reason: (formData.get('reason') as string) || '',
              overwrite: formData.get('overwrite') === 'on',
            }
            if (!options.from || !options.to) {
              this.ctx.modal.notify('error', {
                title: $`Failed to redirect`,
                content: $`From and to are required.`,
              })
              return
            }
            this.ctx.emit('quick-redirect/submit', { ctx: this.ctx, payload: options })
            modal.setLoadingState(true)
            this.redirectPage(options)
              .then((res) => {
                modal.close()
                this.ctx.modal.notify('success', {
                  title: $`Redirect successful`,
                  content: $`The redirect has been created.`,
                })
              })
              .catch((error) => {
                modal.setLoadingState(false)
                this.ctx.modal.notify('error', {
                  title: $`Failed to redirect`,
                  content: error instanceof Error ? error.message : String(error),
                })
              })
          }}
        >
          <TwinSwapInput
            inputs={[
              {
                label: $`Redirect from`,
                name: 'from',
                value: options?.from,
                required: true,
              },
              {
                label: $`Redirect to`,
                name: 'to',
                value: options?.to,
                required: true,
              },
            ]}
          />
          <InputBox
            label={$`Reason`}
            id="reason"
            name="reason"
            value={options?.reason ?? reason ?? ''}
          />
          <div>
            <CheckBox name="overwrite" id="overwrite" checked={options?.overwrite}>
              {$`Force create redirect even if the from page already exists`}
            </CheckBox>
          </div>
        </form>
      ) as HTMLFormElement
    )
    modal.setButtons([
      {
        label: $`Create Redirect`,
        className: 'is-primary is-ghost',
        method: () => {
          formRef?.dispatchEvent(new Event('submit'))
        },
      },
    ])

    this.ctx.emit('quick-redirect/show-modal', { ctx: this.ctx, modal })

    return modal.show()
  }

  async redirectPage(options: RedirectPageOptions) {
    const { from, to, reason = '', overwrite = false } = options
    const wikiPage = await this.ctx.wikiPage.newBlankPage({
      title: from,
    })
    const content = `#REDIRECT [[:${to}]]`
    return wikiPage.edit(
      {
        text: content,
        summary: reason,
      },
      {
        createonly: !overwrite,
      }
    )
  }
}
