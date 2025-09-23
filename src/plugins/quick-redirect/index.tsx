import { InPageEdit } from '@/InPageEdit'

declare module '@/InPageEdit' {
  interface InPageEdit {
    quickRedirect: PluginQuickRedirect
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
  static readonly inject = ['api', 'wikiPage', 'modal']

  constructor(public ctx: InPageEdit) {
    super(ctx, {}, 'quick-redirect')
  }

  protected start(): Promise<void> | void {
    this.ctx.set('quickRedirect', this)

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
        tooltip: 'Quick Redirect',
        group: 'group1',
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

  showModal(options?: Partial<QuickRedirectOptions>) {
    const modal = this.ctx.modal
      .createObject({
        title: 'Quick Redirect',
        content: (<ProgressBar />) as HTMLElement,
        className: 'quick-redirect',
        sizeClass: 'medium',
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
            const formData = new FormData(formRef!)
            const options = {
              from: formData.get('from') as string,
              to: formData.get('to') as string,
              reason: (formData.get('reason') as string) || '',
              overwrite: formData.get('overwrite') === 'on',
            }
            modal.setLoadingState(true)
            this.redirectPage(options)
              .then((res) => {
                modal.close()
                this.ctx.modal.notify('success', {
                  title: 'Redirect successful',
                  content: 'The redirect has been created.',
                })
              })
              .catch((error) => {
                modal.setLoadingState(false)
                this.ctx.modal.notify('error', {
                  title: 'Failed to redirect',
                  content: error instanceof Error ? error.message : String(error),
                })
              })
          }}
        >
          <TwinSwapInput
            inputs={[
              {
                label: 'From',
                name: 'from',
                value: options?.from,
              },
              {
                label: 'To',
                name: 'to',
                value: options?.to,
              },
            ]}
          />
          <InputBox label="Reason" id="reason" name="reason" value={options?.reason} />
          <div>
            <CheckBox name="overwrite" id="overwrite" checked={options?.overwrite}>
              Force create redirect even if the from page already exists
            </CheckBox>
          </div>
          <ActionButton type="primary" buttonProps={{ style: { width: '100%' } }}>
            Create Redirect
          </ActionButton>
        </form>
      ) as HTMLFormElement
    )

    return modal.show()
  }

  async redirectPage(options: RedirectPageOptions) {
    const { from, to, reason = '', overwrite = false } = options
    const wikiPage = await this.ctx.wikiPage.newBlankPage({
      title: from,
    })
    const content = `#REDIRECT [[:${to}]]`
    const res = await wikiPage.edit(
      {
        text: content,
        summary: reason,
      },
      {
        createonly: !overwrite,
      }
    )
    if (res.data?.errors) {
      throw new Error(res.data.errors[0].text, { cause: res })
    }
    return res
  }
}
