import { Inject, InPageEdit } from '@/InPageEdit'

declare module '@/InPageEdit' {
  interface InPageEdit {
    quickMove: PluginQuickMove['quickMove']
    movePage: PluginQuickMove['movePage']
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

@Inject(['modal', 'sitemeta'])
export class PluginQuickMove extends BasePlugin {
  constructor(public ctx: InPageEdit) {
    super(ctx, {}, 'quick-move')
    ctx.set('quickMove', this.quickMove.bind(this))
    ctx.set('movePage', this.movePage.bind(this))
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
      group: 'group2',
      onClick: () => {
        this.quickMove(
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

  quickMove(options?: Partial<QuickMoveOptions>) {
    const modal = this.ctx.modal
      .createObject({
        title: 'Quick Move',
        content: (<ProgressBar />) as HTMLElement,
        className: 'quick-move compact-buttons',
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
              },
              {
                label: 'Move to',
                name: 'to',
                value: options?.to,
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
          {this.ctx.sitemeta.hasRight('suppressredirect') && (
            <div>
              <CheckBox name="noredirect" id="noredirect" checked={options?.noredirect}>
                Move without leaving a redirect
              </CheckBox>
            </div>
          )}
          <InputBox label="Reason" id="reason" name="reason" value={options?.reason} />
        </form>
      ) as HTMLElement
    )

    modal.setButtons([
      {
        label: 'Move',
        className: 'is-primary',
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
