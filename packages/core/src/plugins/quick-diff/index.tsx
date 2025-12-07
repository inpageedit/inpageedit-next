import { Inject, InPageEdit, Schema } from '@/InPageEdit'
import { type QuickEditEventPayload } from '@/plugins/quick-edit'
import { IPEModal, IPEModalOptions } from '@inpageedit/modal'
import { DiffTable, DiffTableEvent } from './components/DiffTable'
import { MwApiResponse } from 'wiki-saikou'
import { IWikiPage } from '@/models/WikiPage/index.js'
import { ReactNode } from 'jsx-dom'

declare module '@/InPageEdit' {
  interface InPageEdit {
    quickDiff: PluginQuickDiff
  }
  interface Events {
    'quick-diff/init-options'(payload: {
      ctx: InPageEdit
      options: Partial<CompareApiRequestOptions>
    }): void
    'quick-diff/loaded'(payload: {
      ctx: InPageEdit
      modal: IPEModal
      compare: CompareApiResponse['compare']
    }): void
    'quick-diff/quick-edit-modal'(payload: {
      ctx: InPageEdit
      modal: IPEModal
      wikiPage: IWikiPage
    }): void
  }
  interface PreferencesMap {
    'quickDiff.keyshortcut': string
  }
}

export interface CompareApiRequestOptions {
  fromtitle: string
  fromid: number
  fromrev: number
  frompst: boolean
  totitle: string
  toid: number
  torev: number
  torelative?: 'cur' | 'prev' | 'next'
  topst: boolean
  prop: string
  difftype: 'table' | 'unified'
  // deprecated, but still works
  fromtext: string
  fromsection: string | number
  fromcontentmodel: string
  totext: string
  tosection: string | number
  tocontentmodel: string
}

export interface CompareApiResponse {
  compare: Partial<{
    fromid: number
    fromrevid: number
    fromns: number
    fromtitle: string
    fromsize: number
    fromtimestamp: string
    fromuser: string
    fromuserid: number
    fromcomment: string
    fromparsedcomment?: string
    toid: number
    torevid: number
    tons: number
    totitle: string
    tosize: number
    totimestamp: string
    touser: string
    touserid: number
    tocomment: string
    toparsedcomment: string
    diffsize: number
    prev: number
    next: number
  }> & {
    body: string
  }
}

@Inject(['wiki', 'getUrl', 'preferences', '$'])
@RegisterPreferences(
  Schema.object({
    'quickDiff.keyshortcut': Schema.string()
      .default('ctrl-d')
      .description('Key shortcut to open quick diff in quick edit modal'),
  })
    .description('Quick diff options')
    .extra('category', 'editor')
)
export class PluginQuickDiff extends BasePlugin {
  constructor(public ctx: InPageEdit) {
    super(ctx, {}, 'quick-diff')
  }

  private diffCache = new Map<string, CompareApiResponse['compare']>()

  protected start(): Promise<void> | void {
    this.ctx.set('quickDiff', this)
    this.ctx.on('quick-edit/wiki-page', this.injectQuickEdit.bind(this))
    window.RLQ.push(this.injectHistoryPage.bind(this))
  }

  protected stop(): Promise<void> | void {}

  private injectHistoryPage() {
    const { $ } = this.ctx
    const mwCompareForm = qs<HTMLFormElement>('#mw-history-compare')
    if (!mwCompareForm) {
      return
    }
    const compareButtons = qsa('.mw-history-compareselectedversions-button', mwCompareForm)
    compareButtons.forEach((el) => {
      el.after(
        <button
          className="cdx-button"
          onClick={(e) => {
            e.preventDefault()
            const formData = new FormData(mwCompareForm)
            const fromrev = Number(formData.get('oldid')) || 0
            const torev = Number(formData.get('diff')) || 0
            const title = formData.get('title') as string
            if (!title || !fromrev || !torev) {
              return this.logger.warn('Missing title or revision IDs')
            }
            this.comparePages({
              fromrev,
              torev,
            })
          }}
        >
          {$`Quick Diff`}
        </button>
      )
    })
  }

  private async injectQuickEdit({ modal, wikiPage, options }: QuickEditEventPayload) {
    if (wikiPage.pageid === 0 || options.section === 'new') {
      // User is creating a new page, no need to show diff button
      return
    }
    const { $ } = this.ctx
    let latestDiffModal: IPEModal | undefined = undefined
    modal.addButton(
      {
        label: $`Diff`,
        side: 'left',
        keyPress: (await this.ctx.preferences.get('quickDiff.keyshortcut')) || undefined,
        className: 'btn btn-secondary',
        method: () => {
          const pageTitle = wikiPage.title
          const fromtext = wikiPage.revisions?.[0]?.content || ''
          const totext =
            (modal.get$content().querySelector<HTMLTextAreaElement>('textarea[name="text"]')
              ?.value as string) || ''

          if (fromtext === totext) {
            return this.ctx.modal.notify('info', { title: $`Quick Diff`, content: $`No changes` })
          }

          this.ctx.emit('quick-diff/quick-edit-modal', {
            ctx: this.ctx,
            modal,
            wikiPage,
          })

          latestDiffModal = this.comparePages(
            {
              fromtitle: pageTitle,
              fromtext,
              totitle: pageTitle,
              totext,
              topst: true,
            },
            latestDiffModal,
            {
              backdrop: false,
              draggable: true,
            }
          )
          return latestDiffModal
        },
      },
      2
    )
    modal.on(modal.Event.Close, () => {
      latestDiffModal?.destroy()
      latestDiffModal = undefined
    })
  }

  readonly COMPARE_API_DEFAULT_OPTIONS: Partial<CompareApiRequestOptions> = {
    prop: [
      'comment',
      'diff',
      'diffsize',
      'ids',
      'parsedcomment',
      'size',
      'timestamp',
      'title',
      'user',
      'rel',
    ].join('|'),
    difftype: 'table',
  }

  comparePages(
    options: Partial<CompareApiRequestOptions>,
    modal?: IPEModal,
    modalOptions?: Partial<IPEModalOptions>
  ) {
    const { $ } = this.ctx
    if (!modal || modal.isDestroyed) {
      modal = this.ctx.modal
        .createObject({
          title: $`Loading diff...`,
          content: '',
          className: 'quick-diff',
          center: false,
          ...modalOptions,
        })
        .init()
      modal.on(modal.Event.Close, () => {
        this.diffCache.clear()
      })
    } else {
      modal.removeButton('*')
    }

    this.ctx.emit('quick-diff/init-options', {
      ctx: this.ctx,
      options,
    })

    modal.setContent(
      <section
        style={{ height: '70vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
      >
        <ProgressBar />
      </section>
    )
    modal.bringToFront()

    if (window.mw && mw.loader.getState('mediawiki.diff.styles') !== 'ready') {
      mw.loader.load(['mediawiki.diff.styles'])
    }

    const apiOptions = {
      ...this.COMPARE_API_DEFAULT_OPTIONS,
      ...options,
      action: 'compare',
      format: 'json',
      formatversion: 2,
    }
    const cacheKey = JSON.stringify(apiOptions)

    ;(this.diffCache.has(cacheKey)
      ? Promise.resolve({ data: { compare: this.diffCache.get(cacheKey)! } })
      : this.ctx.api.post<MwApiResponse<CompareApiResponse>>(apiOptions)
    )
      .then((res) => {
        if (!res.data.compare) {
          throw new Error('No compare data received', { cause: res })
        }
        const {
          data: { compare },
        } = res
        this.diffCache.set(cacheKey, compare)
        modal.setTitle(
          compare.fromtitle && compare.totitle
            ? `${compare.fromtitle}${compare.fromrevid ? ` (${compare.fromrevid})` : ''} ⇔ ${compare.totitle}${compare.torevid ? ` (${compare.torevid})` : ''}`
            : $`Differences`
        )
        let diffTable!: HTMLElement
        modal.setContent(
          (
            <section
              style={{
                minHeight: '70vh',
              }}
            >
              <DiffTable ref={(ref) => (diffTable = ref)} data={compare} ctx={this.ctx} />
            </section>
          ) as HTMLElement
        )
        diffTable.addEventListener(
          DiffTableEvent.update,
          (e) => {
            e.stopPropagation()
            this.comparePages(
              {
                fromrev: e.detail.fromrev,
                torev: e.detail.torev,
              },
              modal,
              modalOptions
            )
          },
          { once: true }
        )

        // TODO: 不应该硬编码，移动到 in-article-links 插件中
        this.ctx.inject(['quickEdit'], (ctx) => {
          const handleQuickEdit = (e: CustomEvent<{ revid: number }>) => {
            e.stopPropagation()
            ctx.quickEdit({ revision: e.detail.revid })
          }
          diffTable.addEventListener(DiffTableEvent.edit, handleQuickEdit)
          modal.on(modal.Event.Close, () => {
            diffTable.removeEventListener(DiffTableEvent.edit, handleQuickEdit)
          })
        })

        if (compare.fromrevid && compare.torevid) {
          modal.addButton({
            label: $`Original Compare Page`,
            side: 'right',
            className: 'btn btn-secondary',
            method: () => {
              window.location.href = this.ctx.getUrl('', {
                oldid: compare.fromrevid,
                diff: compare.torevid,
              })
            },
          })
        }

        this.ctx.emit('quick-diff/loaded', {
          ctx: this.ctx,
          modal,
          compare,
        })
      })
      .catch((err) => {
        modal.setContent(
          (
            <MBox title={$`Failed to load diff`} type="error">
              <pre>{err instanceof Error ? err.message : String(err)}</pre>
            </MBox>
          ) as HTMLElement
        )
      })

    return modal.show()
  }

  createQuickDiffButton(
    payload: Partial<CompareApiRequestOptions>,
    options?: {
      label?: ReactNode
      icon?: ReactNode
    }
  ) {
    const { $ } = this.ctx
    const icon = options?.icon ?? <IconQuickDiff className="ipe-icon" />
    const label = options?.label ?? $`Quick Diff`
    return (
      <a
        href={`#ipe://quick-diff/`}
        dataset={payload as any}
        className={`ipe-quick-diff`}
        style={{
          userSelect: 'none',
          marginLeft: '0.2em',
        }}
        onClick={(e) => {
          e.preventDefault()
          this.comparePages(payload)
        }}
      >
        {icon}
        {label}
      </a>
    ) as HTMLAnchorElement
  }
}
