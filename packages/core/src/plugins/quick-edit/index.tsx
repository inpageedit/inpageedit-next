import { Inject, InPageEdit, Schema } from '@/InPageEdit'
import { WikiPage } from '@/models/WikiPage'
import { WatchlistAction } from '@/models/WikiPage/types/WatchlistAction'
import { IPEModal } from '@/services/ModalService/IPEModal'
import { ReactNode } from 'jsx-dom'
import { makeCallable } from '@/utils/makeCallable.js'

declare module '@/InPageEdit' {
  interface InPageEdit {
    quickEdit: PluginQuickEdit & {
      (...args: Parameters<PluginQuickEdit['showModal']>): ReturnType<PluginQuickEdit['showModal']>
    }
  }
  interface Events {
    'quick-edit/init-options'(payload: Omit<QuickEditInitPayload, 'modal' | 'wikiPage'>): void
    'quick-edit/show-modal'(payload: Omit<QuickEditInitPayload, 'wikiPage'>): void
    'quick-edit/wiki-page'(payload: QuickEditInitPayload): void
    'quick-edit/edit-notice'(payload: QuickEditInitPayload & { editNotices: ReactNode[] }): void
  }
}

export interface QuickEditOptions {
  title: string
  pageId: number
  revision: number
  /**
   * - `undefined` for full article edit
   * - `0` for the first section
   * - `"new"` for a new section
   */
  section: number | 'new' | undefined
  editMinor: boolean
  editSummary: string
  createOnly: boolean
  reloadAfterSave: boolean
}

export interface QuickEditInitPayload {
  ctx: InPageEdit
  options: QuickEditOptions
  modal: IPEModal
  wikiPage: WikiPage
}

export interface QuickEditSubmitPayload {
  wikiPage: WikiPage
  text?: string
  summary?: string
  section?: number | 'new' | undefined
  minor?: boolean
  createonly?: boolean
  watchlist?: WatchlistAction
}

@Inject(['api', 'wikiPage', 'sitemeta', 'modal', 'preferences'])
@RegisterPreferences(
  Schema.object({
    editSummary: Schema.string()
      .description('Default edit summary for quick edits')
      .default('[IPE-NEXT] Quick edit'),
    editMinor: Schema.boolean().description('Whether to mark the edit as minor').default(false),
    outSideClose: Schema.boolean().description('Whether to close the modal outside').default(true),
    watchList: Schema.union([
      Schema.const(WatchlistAction.preferences).description('Follow my preferences'),
      Schema.const(WatchlistAction.nochange).description('Keep the current watchlist status'),
      Schema.const(WatchlistAction.watch).description('Add the page to watchlist'),
      Schema.const(WatchlistAction.unwatch).description('Remove the page from watchlist'),
    ])
      .description('Watchlist options')
      .default(WatchlistAction.preferences),
  })
    .description('Quick edit options')
    .extra('category', 'edit')
)
export class PluginQuickEdit extends BasePlugin {
  private readonly DEFAULT_OPTIONS: QuickEditOptions = {
    title: '',
    pageId: 0,
    revision: 0,
    section: undefined,
    editMinor: false,
    editSummary: '',
    createOnly: false,
    reloadAfterSave: true,
  }

  constructor(public ctx: InPageEdit) {
    super(ctx, {}, 'quick-edit')
    this.ctx.root.set('quickEdit', makeCallable(this, 'showModal'))
  }

  protected start(): Promise<void> | void {
    this.ctx.inject(['toolbox'], (ctx) => {
      this.injectToolbox(ctx)
      ctx.on('dispose', () => {
        this.removeToolbox(ctx)
      })
    })
  }

  async showModal(payload?: string | Partial<QuickEditOptions>) {
    if (typeof payload === 'undefined') {
      payload = {}
    } else if (typeof payload === 'string') {
      payload = {
        title: payload,
      } as Partial<QuickEditOptions>
    }

    // @ts-expect-error legacy `page` option
    if (payload?.page) {
      // @ts-expect-error
      payload.title = payload.page
      // @ts-expect-error
      delete payload.page
    }

    if (!payload.title && !payload.pageId && !payload.revision) {
      this.logger.warn('None of the title, pageId or revision provided. Using defaults.')
      payload = {
        ...payload,
        title: this.ctx.sitemeta.mwConfig.get('wgPageName'),
        pageId: this.ctx.sitemeta.mwConfig.get('wgArticleId'),
        revision: this.ctx.sitemeta.mwConfig.get('wgRevisionId'),
      }
    }

    const outSideClose = (await this.ctx.preferences.get<boolean>('outSideClose'))!
    const watchList = (await this.ctx.preferences.get<WatchlistAction>('watchList'))!
    const editSummary =
      typeof payload.editSummary === 'string'
        ? payload.editSummary
        : (await this.ctx.preferences.get<string>('editSummary'))!
    const editMinor =
      typeof payload.editMinor === 'boolean'
        ? payload.editMinor
        : (await this.ctx.preferences.get<boolean>('editMinor'))!

    const options: QuickEditOptions = {
      ...this.DEFAULT_OPTIONS,
      editSummary,
      editMinor,
      ...payload,
    }
    if (!options.editSummary) {
      options.editSummary = (await this.ctx.preferences.get<string>('editSummary')) || ''
    }
    if (!options) this.ctx.emit('quick-edit/init-options', { ctx: this.ctx, options })

    const modal = this.ctx.modal
      .createObject({
        className: 'ipe-quickEdit',
        sizeClass: 'large',
        // backdrop: false,
        // draggable: true,
        center: false,
        outSideClose,
      })
      .init()
    modal.setTitle(
      (
        <>
          Loading: <u>{options.title}</u>
        </>
      ) as HTMLElement
    )
    modal.setContent(
      (
        <section
          className="ipe-quickEdit-loading"
          style={{
            height: '70vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <ProgressBar />
        </section>
      ) as HTMLElement
    )
    modal.addButton({
      side: 'right',
      type: 'button',
      className: 'is-danger is-ghost',
      label: 'Cancel',
      method() {
        modal.close()
      },
    })
    modal.show()
    this.ctx.emit('quick-edit/show-modal', { ctx: this.ctx, modal, options })

    let wikiPage: WikiPage
    try {
      wikiPage = await this.getWikiPageFromPayload(options)
      if (wikiPage.pageInfo.special) {
        throw new Error('Special page is not editable')
      }
    } catch (e) {
      modal.off(modal.Event.Close)
      modal.close()
      this.ctx.modal.notify('error', {
        content: e instanceof Error ? e.message : String(e),
      })
      return
    }
    modal.setTitle(
      (
        <>
          Quick {wikiPage.pageInfo.pageid === 0 ? 'Create' : 'Edit'}:{' '}
          <u>{wikiPage.pageInfo.title}</u>
        </>
      ) as HTMLElement
    )

    const editNotices = [] as ReactNode[]
    // Page not exists
    if (wikiPage.pageInfo.pageid === 0) {
      editNotices.push(
        <MBox title="Attention" type="important">
          <p>This page does not exist.</p>
        </MBox>
      )
    }
    // Edit based on old revision
    if (wikiPage.pageInfo.pageid && wikiPage.pageInfo.lastrevid !== wikiPage.revisions[0]?.revid) {
      editNotices.push(
        <MBox title="Attention" type="warning">
          <p>You are editing a revision that is not the latest.</p>
        </MBox>
      )
    }
    this.ctx.emit('quick-edit/edit-notice', {
      ctx: this.ctx,
      options,
      modal,
      wikiPage,
      editNotices,
    })

    const editForm = (
      <form className="ipe-quickEdit__form">
        <div className="ipe-quickEdit__notices">{editNotices}</div>
        <div className="ipe-quickEdit__content">
          <textarea className="ipe-quickEdit__textarea" name="text" id="wpTextbox1">
            {wikiPage.revisions[0]?.content || ''}
          </textarea>
        </div>
        <div
          class="ipe-quickEdit__options"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            marginTop: '1rem',
          }}
        >
          <InputBox label="Summary" id="summary" name="summary" value={options.editSummary} />
          <div className="ipe-input-box">
            <label htmlFor="watchlist" style={{ display: 'block' }}>
              Watchlist
            </label>
            <div style={{ display: 'flex', gap: '1rem' }}>
              {[
                WatchlistAction.preferences,
                WatchlistAction.nochange,
                WatchlistAction.watch,
                WatchlistAction.unwatch,
              ].map((action) => (
                <RadioBox
                  key={action}
                  name="watchlist"
                  value={action}
                  inputProps={{ checked: watchList === action }}
                >
                  {action}
                </RadioBox>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <CheckBox name="minor" id="minor" checked={options.editMinor}>
              Minor edit
            </CheckBox>
            <CheckBox name="reloadAfterSave" id="reloadAfterSave" checked={options.reloadAfterSave}>
              Reload after save
            </CheckBox>
          </div>
        </div>
        {/* Debug Info */}
        {import.meta.env.DEV && (
          <div className="debug" style={{ marginTop: '1rem' }}>
            <details>
              <pre>{JSON.stringify(wikiPage.pageInfo, null, 2)}</pre>
            </details>
          </div>
        )}
      </form>
    ) as HTMLFormElement
    modal.setContent(editForm)
    // shamefully fix: make sure the submit button is always the first
    modal.addButton(
      {
        side: 'left',
        className: 'is-primary submit-btn',
        label: 'Submit',
        method: () => {
          const formData = new FormData(editForm)
          console.info(wikiPage, editForm, {
            text: formData.get('text') as string,
            summary: formData.get('summary') as string,
            minor: formData.get('minor') === 'on',
          })
          modal.setLoadingState(true)
          this.handleSubmit({
            wikiPage,
            text: formData.get('text') as string,
            summary: formData.get('summary') as string,
            minor: formData.get('minor') === 'on',
            section: options.section,
            createonly: wikiPage.pageid === 0,
            watchlist: watchList,
          })
            .then(async () => {
              modal.setOptions({
                beforeClose: noop,
              })
              modal.close()
              this.ctx.modal.notify('success', {
                title: 'Submission Successful',
                content: 'Your changes have been saved.',
              })
              if (formData.get('reloadAfterSave')) {
                await sleep(500)
                location.reload()
              }
            })
            .catch((error) => {
              this.ctx.modal.notify('error', {
                title: 'Submission Error',
                content: error instanceof Error ? error.message : String(error),
              })
              modal.setLoadingState(false)
            })
        },
      },
      0
    )
    modal.setOptions({
      beforeClose: () => {
        const oldStr = wikiPage.revisions[0]?.content || ''
        const newStr = editForm.querySelector('textarea')?.value || ''
        if (newStr === oldStr) {
          return true
        } else {
          this.ctx.modal.confirm(
            {
              className: 'is-primary',
              title: 'Unsaved Changes',
              content:
                'All edit contents will be lost after closing the modal. Are you sure you want to close?',
              center: true,
              okBtn: {
                label: 'Give Up',
                className: 'is-danger is-ghost',
              },
              cancelBtn: {
                label: 'Continue Editing',
                className: 'is-primary is-ghost',
              },
            },
            (confirmed) => {
              if (confirmed) {
                modal.setOptions({
                  beforeClose: noop,
                })
                modal.close()
              }
              return true
            }
          )
          return false
        }
      },
    })
    this.ctx.emit('quick-edit/wiki-page', {
      ctx: this.ctx,
      options,
      modal,
      wikiPage,
    })

    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (editForm.querySelector('textarea')?.value === wikiPage.revisions[0]?.content) {
        return true
      }
      e.preventDefault()
      return 'You have unsaved changes. Are you sure you want to leave?'
    }
    window.addEventListener('beforeunload', beforeUnload)
    modal.on(modal.Event.Close, () => {
      window.removeEventListener('beforeunload', beforeUnload)
    })
  }

  async handleSubmit(payload: QuickEditSubmitPayload) {
    const wikiPage = payload.wikiPage
    const summary = payload.summary || ''
    const text = payload.text || ''
    const minor = payload.minor
    const createonly = payload.createonly
    const watchlist = payload.watchlist
    const section = payload.section

    return wikiPage.edit(
      {
        summary,
        text,
        watchlist,
        section,
      },
      {
        minor,
        createonly,
      }
    )
  }

  async getWikiPageFromPayload(payload: Partial<QuickEditOptions>) {
    if (payload.revision) {
      return this.ctx.wikiPage.newFromRevision(payload.revision, payload.section)
    } else if (payload.pageId) {
      return this.ctx.wikiPage.newFromPageId(payload.pageId, payload.section)
    } else if (payload.title) {
      return this.ctx.wikiPage.newFromTitle(payload.title, false, payload.section)
    }
    throw new Error('Invalid payload')
  }

  private injectToolbox(ctx: InPageEdit) {
    ctx.toolbox.addButton({
      id: 'quick-edit',
      group: 'group1',
      index: 0,
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
          class="icon icon-tabler icons-tabler-outline icon-tabler-edit"
        >
          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
          <path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1" />
          <path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415z" />
          <path d="M16 5l3 3" />
        </svg>
      ) as HTMLElement,
      tooltip: 'Edit this page quickly',
      onClick: () =>
        this.showModal({
          revision: this.ctx.sitemeta.mwConfig.get('wgRevisionId'),
        }),
    })
  }

  protected removeToolbox(ctx: InPageEdit) {
    ctx.toolbox.removeButton('quick-edit')
  }
}
