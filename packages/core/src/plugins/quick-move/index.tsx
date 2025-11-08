import { Inject, InPageEdit, Schema } from '@/InPageEdit'
import { IPEModal } from '@inpageedit/modal'

declare module '@/InPageEdit' {
  interface InPageEdit {
    quickMove: PluginQuickMove
  }
  interface Events {
    'quick-move/init-options'(payload: {
      ctx: InPageEdit
      options: Partial<QuickMoveOptions>
    }): void
    'quick-move/show-modal'(payload: { ctx: InPageEdit; modal: IPEModal }): void
    'quick-move/submit'(payload: {
      ctx: InPageEdit
      modal: IPEModal
      payload: MovePageOptions
    }): void
  }
  interface PreferencesMap {
    'quickMove.reason': string
  }
}

export interface MovePageOptions {
  from: string
  to: string
  reason?: string
  movetalk?: boolean
  movesubpages?: boolean
  noredirect?: boolean
}
export interface QuickMoveOptions extends Partial<MovePageOptions> {
  lockFromField?: boolean
  lockToField?: boolean
}

@RegisterPreferences(
  Schema.object({
    'quickMove.reason': Schema.string().default('[IPE-NEXT] Quick move'),
  })
    .description('Quick move options')
    .extra('category', 'editor')
)
@Inject(['modal', 'wiki'])
export class PluginQuickMove extends BasePlugin {
  constructor(public ctx: InPageEdit) {
    super(ctx, {}, 'quick-move')
    ctx.set('quickMove', this)
  }

  protected start(): Promise<void> | void {
    this.ctx.inject(['toolbox'], (ctx) => {
      this.injectToolbox(ctx)
    })
  }

  private injectToolbox(ctx: InPageEdit) {
    const curPageName = window.mw?.config.get('wgPageName') || ''
    const canEdit = window.mw?.config.get('wgIsProbablyEditable')
    ctx.toolbox.addButton({
      id: 'quick-move',
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
          class="icon icon-tabler icons-tabler-outline icon-tabler-forms"
        >
          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
          <path d="M12 3a3 3 0 0 0 -3 3v12a3 3 0 0 0 3 3" />
          <path d="M6 3a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3" />
          <path d="M13 7h7a1 1 0 0 1 1 1v8a1 1 0 0 1 -1 1h-7" />
          <path d="M5 7h-1a1 1 0 0 0 -1 1v8a1 1 0 0 0 1 1h1" />
          <path d="M17 12h.01" />
          <path d="M13 12h.01" />
        </svg>
      ),
      tooltip: 'Quick Move',
      group: 'group1',
      index: 1,
      onClick: () => {
        this.showModal(
          canEdit
            ? {
                lockFromField: true,
                from: curPageName,
              }
            : {}
        )
      },
    })
  }

  async showModal(options?: Partial<QuickMoveOptions>) {
    const reason = await this.ctx.preferences.get('quickMove.reason')
    const modal = this.ctx.modal
      .createObject({
        title: 'Quick Move',
        content: (<ProgressBar />) as HTMLElement,
        className: 'quick-move compact-buttons',
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
              movetalk: formData.get('movetalk') === 'on',
              movesubpages: formData.get('movesubpages') === 'on',
              noredirect: formData.get('noredirect') === 'on',
            }
            if (!options.from || !options.to) {
              this.ctx.modal.notify('error', {
                title: 'Failed to move',
                content: 'From and to are required.',
              })
              return
            }
            this.ctx.emit('quick-move/submit', { ctx: this.ctx, modal, payload: options })
            modal.setLoadingState(true)
            this.movePage(options)
              .then(() => {
                location.reload()
              })
              .catch((error) => {
                modal.setLoadingState(false)
                this.ctx.modal.notify('error', {
                  title: 'Failed to move',
                  content: error instanceof Error ? error.message : String(error),
                })
              })
          }}
        >
          <TwinSwapInput
            inputs={[
              {
                label: 'Move from',
                name: 'from',
                value: options?.from,
                required: true,
              },
              {
                label: 'Move to',
                name: 'to',
                value: options?.to,
                required: true,
              },
            ]}
          />
          <div>
            <CheckBox name="movetalk" id="movetalk" checked={options?.movetalk}>
              Move talk page
            </CheckBox>
          </div>
          <div>
            <CheckBox name="movesubpages" id="movesubpages" checked={options?.movesubpages}>
              Move subpage(s) (up to 100)
            </CheckBox>
          </div>
          {this.ctx.wiki.hasRight('suppressredirect') && (
            <div>
              <CheckBox name="noredirect" id="noredirect" checked={options?.noredirect}>
                Move without leaving a redirect
              </CheckBox>
            </div>
          )}
          <InputBox
            label="Reason"
            id="reason"
            name="reason"
            value={options?.reason ?? reason ?? ''}
          />
        </form>
      ) as HTMLElement
    )

    modal.setButtons([
      {
        label: 'Move',
        className: 'is-primary is-ghost',
        method: () => {
          formRef?.dispatchEvent(new Event('submit'))
        },
      },
    ])

    return modal.show()
  }

  async movePage(options: MovePageOptions) {
    const { from, to, reason = '', ...rest } = options

    if (!from || !to) {
      throw new Error('From and to titles are required.')
    }
    if (from === to) {
      throw new Error('From and to titles cannot be the same.')
    }

    const wikiPage = await this.ctx.wikiPage.newFromTitle(from)
    return wikiPage.moveTo(to, reason, rest)
  }
}
