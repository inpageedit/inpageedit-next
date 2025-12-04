import { Inject, InPageEdit, Schema } from '@/InPageEdit'
import { IWikiPage } from '@/models/WikiPage'
import { WatchlistAction } from '@/models/WikiPage/types/WatchlistAction'
import { IPEModal } from '@inpageedit/modal'
import { ReactNode } from 'jsx-dom'
import { makeCallable } from '@/utils/makeCallable.js'
import { MediaWikiApiError } from 'wiki-saikou'

declare module '@/InPageEdit' {
  interface InPageEdit {
    quickEdit: PluginQuickEdit & {
      (...args: Parameters<PluginQuickEdit['showModal']>): ReturnType<PluginQuickEdit['showModal']>
    }
  }
  interface Events {
    'quick-edit/init-options'(payload: Omit<QuickEditEventPayload, 'modal' | 'wikiPage'>): void
    'quick-edit/show-modal'(payload: Omit<QuickEditEventPayload, 'wikiPage'>): void
    'quick-edit/wiki-page'(payload: QuickEditEventPayload): void
    'quick-edit/edit-notice'(payload: QuickEditEventPayload & { editNotices: ReactNode[] }): void
    'quick-edit/submit'(payload: QuickEditSubmitPayload & { ctx: InPageEdit }): void
  }
  interface PreferencesMap {
    'quickEdit.editSummary': string
    'quickEdit.editMinor': boolean
    'quickEdit.outSideClose': boolean
    'quickEdit.watchList': WatchlistAction
    'quickEdit.keyshortcut.save': string
    'quickEdit.editFont': string
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

export interface QuickEditEventPayload {
  ctx: InPageEdit
  options: QuickEditOptions
  modal: IPEModal
  wikiPage: IWikiPage
}

export interface QuickEditSubmitPayload {
  wikiPage: IWikiPage
  text?: string
  summary?: string
  section?: number | 'new' | undefined
  minor?: boolean
  createonly?: boolean
  recreate?: boolean
  watchlist?: WatchlistAction
}

@Inject(['api', 'wikiPage', 'wikiTitle', 'currentPage', 'wiki', 'modal', 'preferences', '$'])
@RegisterPreferences(
  Schema.object({
    'quickEdit.editSummary': Schema.string()
      .description('Default edit summary for quick edits')
      .default('[IPE-NEXT] Quick edit'),
    'quickEdit.editMinor': Schema.boolean()
      .description('Default to checking "minor edit" option')
      .default(false),
    'quickEdit.outSideClose': Schema.boolean()
      .description('Close editor modal by clicking outside')
      .default(true),
    'quickEdit.watchList': Schema.union([
      Schema.const(WatchlistAction.preferences).description('Follow MW preferences'),
      Schema.const(WatchlistAction.nochange).description('Keep the current watchlist status'),
      Schema.const(WatchlistAction.watch).description('Add the page to watchlist'),
      Schema.const(WatchlistAction.unwatch).description('Remove the page from watchlist'),
    ])
      .description('Watchlist options')
      .default(WatchlistAction.preferences),
    'quickEdit.keyshortcut.save': Schema.string()
      .default('ctrl-s')
      .description('save button key shortcut (blank to disable)'),
    'quickEdit.editFont': Schema.union([
      Schema.const('preferences').description('Follow MW preferences'),
      Schema.const('monospace').description('Monospace'),
      Schema.const('sans-serif').description('Sans-serif'),
      Schema.const('serif').description('Serif'),
      Schema.string().description('Custom font (same as CSS `font-family` property)').default(''),
    ])
      .description("Font to use in quick edit's textarea")
      .default('preferences'),
  })
    .description('Quick edit options')
    .extra('category', 'editor')
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
    const { $ } = this.ctx
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
      const searchParams = new URLSearchParams(window.location.search)
      const title = this.ctx.currentPage.wikiTitle
      payload = {
        ...payload,
        title: title?.getPrefixedDBKey(),
        revision: searchParams.has('oldid') ? Number(searchParams.get('oldid')) : undefined,
        pageId: searchParams.has('curid') ? Number(searchParams.get('curid')) : undefined,
      }
    }

    if (!payload.revision && !payload.pageId && payload.title) {
      const realTarget = this.ctx.wikiTitle.resolveSpecialPageTarget(payload.title)
      if (realTarget && realTarget.title.getNamespaceId() >= 0) {
        payload.title = realTarget.title.getPrefixedDBKey()
        payload.section ??= realTarget.section
      }
    }

    const outSideClose = (await this.ctx.preferences.get('quickEdit.outSideClose'))!
    const watchList = (await this.ctx.preferences.get('quickEdit.watchList'))!
    const editSummary =
      typeof payload.editSummary === 'string'
        ? payload.editSummary
        : (await this.ctx.preferences.get('quickEdit.editSummary'))!
    const editMinor =
      typeof payload.editMinor === 'boolean'
        ? payload.editMinor
        : (await this.ctx.preferences.get('quickEdit.editMinor'))!
    const fontOptions = await this.getEditFontOptions()

    const options: QuickEditOptions = {
      ...this.DEFAULT_OPTIONS,
      editSummary,
      editMinor,
      ...payload,
    }
    if (!options.editSummary) {
      options.editSummary = (await this.ctx.preferences.get('quickEdit.editSummary')) || ''
    }
    this.ctx.emit('quick-edit/init-options', { ctx: this.ctx, options })

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
      label: $`Cancel`,
      method() {
        modal.close()
      },
    })
    modal.show()
    this.ctx.emit('quick-edit/show-modal', { ctx: this.ctx, modal, options })

    let wikiPage: IWikiPage
    try {
      wikiPage = await this.getWikiPageFromPayload(options)
      if (wikiPage.pageInfo.special) {
        throw new Error($`Special page is not editable.`)
      }
    } catch (e) {
      modal.off(modal.Event.Close)
      modal.close()
      this.ctx.modal.notify('error', {
        content: e instanceof Error ? e.message : String(e),
      })
      return
    }

    const edittingContent = options.section === 'new' ? '' : wikiPage.revisions[0]?.content || ''
    const edittingRevId = wikiPage.revisions[0]?.revid
    const isEdittingOld = edittingRevId && edittingRevId !== wikiPage.lastrevid
    const isCreatingNewSection = options.section === 'new'
    const isCreatingNewPage = wikiPage.pageid === 0

    modal.setTitle(
      (
        <>
          {isCreatingNewSection
            ? $`New Section`
            : $`Quick ${isCreatingNewPage ? 'Create' : 'Edit'}`}
          : <u>{wikiPage.pageInfo.title}</u>
          {isEdittingOld ? ` (${$`Revision`} ${edittingRevId})` : ''}
        </>
      ) as HTMLElement
    )

    const editNotices = [] as ReactNode[]
    // Page not exists
    if (isCreatingNewPage) {
      editNotices.push(
        <MBox title={$`Attention`} type="important">
          <p>{$`This page does not exist.`}</p>
        </MBox>
      )
    }
    // Edit based on old revision
    if (isEdittingOld) {
      editNotices.push(
        <MBox title={$`Attention`} type="warning">
          <p
            innerHTML={$`You are editing a <em>historical version</em>; the content is not the latest!`}
          ></p>
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
        <div
          className="ipe-quickEdit__content"
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          {options.section === 'new' && (
            <>
              <InputBox
                label={$`Section title`}
                id="summary"
                name="summary"
                value={''}
                inputProps={{ placeholder: $`Topic for new section, this will be the h2 heading` }}
              />
            </>
          )}
          <textarea
            className={`ipe-quickEdit__textarea ${fontOptions.className}`}
            style={{ fontFamily: fontOptions.fontFamily }}
            name="text"
            id="wpTextbox1"
          >
            {edittingContent}
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
          {!isCreatingNewSection && (
            <InputBox label={$`Summary`} id="summary" name="summary" value={options.editSummary} />
          )}
          <div className="ipe-input-box">
            <label htmlFor="watchlist" style={{ display: 'block' }}>
              {$`Watchlist`}
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
                  {$`watchlist.${action}`}
                </RadioBox>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <CheckBox name="minor" id="minor" checked={options.editMinor}>
              {$`Minor edit`}
            </CheckBox>
            <CheckBox name="reloadAfterSave" id="reloadAfterSave" checked={options.reloadAfterSave}>
              {$`Reload after save`}
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

    let dismissWarnings = false
    modal.addButton(
      {
        side: 'left',
        className: 'is-primary submit-btn',
        label: $`Submit`,
        keyPress: (await this.ctx.preferences.get('quickEdit.keyshortcut.save')) || undefined,
        method: async () => {
          const formData = new FormData(editForm)
          console.info(wikiPage, editForm, {
            text: formData.get('text') as string,
            summary: formData.get('summary') as string,
            minor: formData.get('minor') === 'on',
          })
          modal.setLoadingState(true)

          try {
            await this.handleSubmit({
              wikiPage,
              text: formData.get('text') as string,
              summary: formData.get('summary') as string,
              minor: formData.get('minor') === 'on',
              section: options.section,
              watchlist: watchList,
              // 如果无视风险，那么就不再尝试解决冲突，直接重建页面
              createonly: wikiPage.pageid === 0 && !dismissWarnings,
              recreate: wikiPage.pageid === 0 && dismissWarnings,
            })

            modal.setOptions({
              beforeClose: noop,
            })
            modal.close()

            this.ctx.modal.notify('success', {
              title: $`Submission Successful`,
              content: $`Your changes have been saved.`,
            })

            if (formData.get('reloadAfterSave')) {
              await sleep(500)
              location.reload()
            }
          } catch (error) {
            modal.setLoadingState(false)

            if (MediaWikiApiError.is(error)) {
              if (
                error.code === 'pagedeleted' ||
                error.code === 'editconflict' ||
                error.code === 'articleexists'
              ) {
                dismissWarnings = true
                this.ctx.modal.notify('warning', {
                  title: $`Submission Error`,
                  content: (
                    <div>
                      <p>
                        <strong>{error.message}</strong>
                      </p>
                      <p>{$`You can try to submit again to dismiss the warnings.`}</p>
                    </div>
                  ),
                  closeAfter: 15 * 1000,
                })
                return // can be dismissed by re-submission
              }
            }

            // Errors not handled above
            this.ctx.modal.notify('error', {
              title: $`Submission Error`,
              content: error instanceof Error ? error.message : String(error),
            })
          }
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
              title: $`Unsaved Changes`,
              content: $`All edit contents will be lost after closing the modal. Are you sure you want to close?`,
              center: true,
              okBtn: {
                label: $`Give Up`,
                className: 'is-danger is-ghost',
              },
              cancelBtn: {
                label: $`Continue Editing`,
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
      if (editForm.querySelector('textarea')?.value === edittingContent) {
        return true
      }
      e.preventDefault()
      return $`You have unsaved changes. Are you sure you want to leave?`
    }
    window.addEventListener('beforeunload', beforeUnload)
    modal.on(modal.Event.Close, () => {
      window.removeEventListener('beforeunload', beforeUnload)
    })
  }

  async handleSubmit(payload: QuickEditSubmitPayload) {
    const { wikiPage, ...rest } = payload

    this.ctx.emit('quick-edit/submit', {
      ctx: this.ctx,
      wikiPage,
      ...rest,
    })

    return wikiPage.edit({
      ...rest,
    })
  }

  static readonly BUILT_IN_FONT_OPTIONS = ['preferences', 'monospace', 'sans-serif', 'serif']
  async getEditFontOptions() {
    const prefEditFont = (await this.ctx.preferences.get('quickEdit.editFont'))!
    if (PluginQuickEdit.BUILT_IN_FONT_OPTIONS.includes(prefEditFont)) {
      const editfont =
        prefEditFont === 'preferences'
          ? this.ctx.wiki.userOptions?.editfont || 'monospace'
          : prefEditFont
      return {
        className: `mw-editfont-${editfont}`,
        fontFamily: '',
      }
    } else {
      return {
        className: 'mw-editfont-custom',
        fontFamily: prefEditFont,
      }
    }
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

  private async injectToolbox(ctx: InPageEdit) {
    const { $ } = this.ctx
    const title = this.ctx.currentPage.wikiTitle
    const canEdit = title && title.getNamespaceId() >= 0
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
      buttonProps: {
        disabled: !canEdit,
      },
      tooltip: () => (canEdit ? $`Quick Edit` : $`Not editable`),
      onClick: () => {
        const revision = new URLSearchParams(window.location.search).get('oldid')
        this.showModal({
          title: title?.getPrefixedText(),
          revision: revision ? Number(revision) : undefined,
        })
      },
    })
  }

  protected removeToolbox(ctx: InPageEdit) {
    ctx.toolbox.removeButton('quick-edit')
  }

  createQuickEditButton(
    payload: Partial<QuickEditOptions>,
    options?: {
      icon?: ReactNode
      label?: ReactNode
    }
  ) {
    const { $ } = this.ctx
    const icon = options?.icon ?? <IconQuickEdit className="ipe-icon" />
    const label = options?.label ?? $`Quick Edit`
    return (
      <a
        href={`#ipe://quick-edit/`}
        dataset={payload as any}
        className={`ipe-quick-edit ${payload.createOnly ? 'ipe-quick-edit--create-only' : ''}`}
        style={{
          userSelect: 'none',
          marginLeft: '0.2em',
        }}
        onClick={(e) => {
          e.preventDefault()
          this.showModal(payload)
        }}
      >
        {icon}
        {label}
      </a>
    ) as HTMLAnchorElement
  }
}
