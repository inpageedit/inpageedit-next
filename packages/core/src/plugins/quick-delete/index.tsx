import { Inject, InPageEdit, Schema } from '@/InPageEdit'
import { IWikiPage } from '@/models/WikiPage'
import { IPEModal } from '@inpageedit/modal'
import { ReactNode } from 'jsx-dom'
import { makeCallable } from '@/utils/makeCallable.js'

declare module '@/InPageEdit' {
  interface InPageEdit {
    quickDelete: PluginQuickDelete & {
      (
        ...args: Parameters<PluginQuickDelete['showModal']>
      ): ReturnType<PluginQuickDelete['showModal']>
    }
  }
  interface Events {
    'quick-delete/init-options'(payload: Omit<QuickDeleteInitPayload, 'modal' | 'wikiPage'>): void
    'quick-delete/show-modal'(payload: Omit<QuickDeleteInitPayload, 'wikiPage'>): void
    'quick-delete/wiki-page'(payload: QuickDeleteInitPayload): void
    'quick-delete/delete-notice'(
      payload: QuickDeleteInitPayload & { deleteNotices: ReactNode[] }
    ): void
    'quick-delete/submit'(payload: QuickDeleteSubmitPayload & { ctx: InPageEdit }): void
  }
}

export interface QuickDeleteOptions {
  title: string
  pageId: number
  revision: number
  deleteReason: string
  reloadAfterDelete: boolean
}

export interface QuickDeleteInitPayload {
  ctx: InPageEdit
  options: QuickDeleteOptions
  modal: IPEModal
  wikiPage: IWikiPage
}

export interface QuickDeleteSubmitPayload {
  wikiPage: IWikiPage
  reason?: string
}

@Inject(['api', 'wikiPage', 'wikiTitle', 'currentPage', 'wiki', 'modal', 'preferences'])
@RegisterPreferences(
  Schema.object({
    deleteReason: Schema.string()
      .description('Default delete reason for quick delete')
      .default('[IPE-NEXT] Quick delete'),
  })
    .description('Quick delete options')
    .extra('category', 'delete')
)
export class PluginQuickDelete extends BasePlugin {
  private readonly DEFAULT_OPTIONS: QuickDeleteOptions = {
    title: '',
    pageId: 0,
    revision: 0,
    deleteReason: '',
    reloadAfterDelete: true,
  }

  constructor(public ctx: InPageEdit) {
    super(ctx, {}, 'quick-delete')
    this.ctx.root.set('quickDelete', makeCallable(this, 'showModal'))
  }

  protected start(): Promise<void> | void {
    this.ctx.inject(['toolbox'], (ctx) => {
      this.injectToolbox(ctx)
      ctx.on('dispose', () => {
        this.removeToolbox(ctx)
      })
    })
    this.ctx.preferences.defineCategory({
      label: 'Delete',
      name: 'delete',
      description: 'Settings related to deleting pages',
      index: 3,
    })
  }

  async showModal(payload?: string | Partial<QuickDeleteOptions>) {
    if (typeof payload === 'undefined') {
      payload = {}
    } else if (typeof payload === 'string') {
      payload = {
        title: payload,
      } as Partial<QuickDeleteOptions>
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

    const deleteReason =
      typeof payload.deleteReason === 'string'
        ? payload.deleteReason
        : (await this.ctx.preferences.get<string>('deleteReason'))!

    const options: QuickDeleteOptions = {
      ...this.DEFAULT_OPTIONS,
      deleteReason,
      ...payload,
    }
    if (!options.deleteReason) {
      options.deleteReason = (await this.ctx.preferences.get<string>('deleteReason')) || ''
    }
    if (!options) this.ctx.emit('quick-delete/init-options', { ctx: this.ctx, options })

    const modal = this.ctx.modal
      .createObject({
        className: 'ipe-quickDelete',
        sizeClass: 'small',
        center: true,
      })
      .init()
    modal.setTitle(
      (
        <>
          Loading: <u>{options.title}</u>
        </>
      ) as HTMLElement
    )
    modal.setContent(<ProgressBar />)
    modal.addButton({
      side: 'right',
      type: 'button',
      className: 'is-ghost',
      label: 'Cancel',
      method() {
        modal.close()
      },
    })
    modal.show()
    this.ctx.emit('quick-delete/show-modal', { ctx: this.ctx, modal, options })

    let wikiPage: IWikiPage
    try {
      wikiPage = await this.getWikiPageFromPayload(options)
      if (wikiPage.pageInfo.special) {
        throw new Error('Special page cannot be deleted')
      }
      if (wikiPage.pageInfo.pageid === 0) {
        throw new Error('Page does not exist, cannot be deleted')
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
          Quick Delete: <u>{wikiPage.pageInfo.title}</u>
        </>
      ) as HTMLElement
    )

    const deleteNotices = [] as ReactNode[]

    // Check delete permissions
    if (!wikiPage.userCan('delete')) {
      deleteNotices.push(
        <MBox title="Permission Denied" type="error">
          <p>You do not have permission to delete this page.</p>
        </MBox>
      )
    }

    // Check if page has protection
    if (wikiPage.pageInfo.protection && wikiPage.pageInfo.protection.length > 0) {
      deleteNotices.push(
        <MBox title="Warning" type="warning">
          <p>
            This page is protected and may has special use or purpose. Delete it at your own risk.
          </p>
        </MBox>
      )
    }

    this.ctx.emit('quick-delete/delete-notice', {
      ctx: this.ctx,
      options,
      modal,
      wikiPage,
      deleteNotices,
    })

    const deleteForm = (
      <form className="ipe-quickDelete__form">
        <div className="ipe-quickDelete__notices">{deleteNotices}</div>
        <div className="ipe-quickDelete__content">
          <div
            className="ipe-quickDelete__page-info"
            style={{
              padding: '1rem',
              backgroundColor: '#f8f9fa',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              marginBottom: '1rem',
            }}
          >
            <ul>
              <li>
                <strong>Title:</strong> {wikiPage.pageInfo.title}
              </li>
              <li>
                <strong>Page ID:</strong> {wikiPage.pageInfo.pageid}
              </li>
              <li>
                <strong>Last Revision:</strong> {wikiPage.pageInfo.lastrevid}
              </li>
              <li>
                <strong>Length:</strong> {wikiPage.pageInfo.length} characters
              </li>
            </ul>
          </div>
        </div>
        <div
          class="ipe-quickDelete__options"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            marginTop: '1rem',
          }}
        >
          <InputBox
            label="Delete Reason"
            id="reason"
            name="reason"
            value={options.deleteReason}
            inputProps={{
              placeholder: 'Enter reason for deletion...',
              required: true,
            }}
          />
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
    modal.setContent(deleteForm)

    // Add delete button
    modal.addButton(
      {
        side: 'left',
        className: 'is-danger submit-btn',
        label: 'Delete Page',
        method: () => {
          const formData = new FormData(deleteForm)
          const reason = formData.get('reason') as string

          if (!reason || reason.trim() === '') {
            this.ctx.modal.notify('error', {
              title: 'Missing Reason',
              content: 'Please provide a reason for deletion.',
            })
            return
          }

          // 二次确认删除
          this.ctx.modal.confirm(
            {
              className: 'is-danger',
              title: 'Confirm Deletion',
              content: (
                <>
                  <p>
                    <strong>{wikiPage.pageInfo.title}</strong>
                  </p>
                </>
              ) as HTMLElement,
              center: true,
              okBtn: {
                label: 'Delete it now',
                className: 'is-danger',
              },
              cancelBtn: {
                label: 'Cancel',
                className: 'is-ghost',
              },
            },
            (confirmed) => {
              if (confirmed) {
                console.info(wikiPage, deleteForm, {
                  reason: reason,
                })

                modal.setLoadingState(true)
                this.handleSubmit({
                  wikiPage,
                  reason,
                })
                  .then(async () => {
                    modal.setOptions({
                      beforeClose: noop,
                    })
                    modal.close()
                    this.ctx.modal.notify('success', {
                      title: 'Deletion Successful',
                      content: `The page "${wikiPage.pageInfo.title}" has been deleted.`,
                    })
                    this.ctx.emit('quick-delete/submit', {
                      ctx: this.ctx,
                      wikiPage,
                      reason,
                    })
                  })
                  .catch((error) => {
                    this.ctx.modal.notify('error', {
                      title: 'Deletion Error',
                      content: error instanceof Error ? error.message : String(error),
                    })
                    modal.setLoadingState(false)
                  })
              }
              return true
            }
          )
        },
      },
      0
    )

    this.ctx.emit('quick-delete/wiki-page', {
      ctx: this.ctx,
      options,
      modal,
      wikiPage,
    })
  }

  async handleSubmit(payload: QuickDeleteSubmitPayload) {
    const wikiPage = payload.wikiPage
    const reason = payload.reason || ''

    return wikiPage.delete(reason)
  }

  async getWikiPageFromPayload(payload: Partial<QuickDeleteOptions>) {
    if (payload.revision) {
      return this.ctx.wikiPage.newFromRevision(payload.revision)
    } else if (payload.pageId) {
      return this.ctx.wikiPage.newFromPageId(payload.pageId)
    } else if (payload.title) {
      return this.ctx.wikiPage.newFromTitle(payload.title, false)
    }
    throw new Error('Invalid payload')
  }

  private async injectToolbox(ctx: InPageEdit) {
    const title = this.ctx.currentPage.wikiTitle
    const canDelete = title && this.ctx.wiki.hasRight('delete') && title.getNamespaceId() >= 0
    ctx.toolbox.addButton({
      id: 'quick-delete',
      group: 'group2',
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
          class="icon icon-tabler icons-tabler-outline icon-tabler-trash"
        >
          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
          <path d="M4 7l16 0" />
          <path d="M10 11l0 6" />
          <path d="M14 11l0 6" />
          <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
          <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
        </svg>
      ) as HTMLElement,
      buttonProps: {
        disabled: !canDelete,
      },
      tooltip: canDelete ? 'Quick Delete' : 'Not deletable',
      onClick: () => {
        this.showModal({
          title: title?.getPrefixedText(),
        })
      },
    })
  }

  protected removeToolbox(ctx: InPageEdit) {
    ctx.toolbox.removeButton('quick-delete')
  }
}
