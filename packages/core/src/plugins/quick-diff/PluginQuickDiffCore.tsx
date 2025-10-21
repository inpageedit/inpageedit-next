import { Inject, InPageEdit, Schema } from '@/InPageEdit'
import { type QuickEditInitPayload } from '@/plugins/quick-edit'
import { JsDiffDiffType } from './JsDiffService'

import styles from './styles.module.sass'
import { ChangeObject } from 'diff'
import { DiffTable } from './components/DiffTable'
import { IPEModal } from '@/services/ModalService/IPEModal.js'

declare module '@/InPageEdit' {
  interface InPageEdit {
    quickDiff: PluginQuickDiffCore
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
  }> & {
    body: string
  }
}

const VALID_DIFF_TYPES = [
  'diffChars',
  'diffWords',
  'diffSentences',
  'diffLines',
  'createTwoFilesPatch',
] as JsDiffDiffType[]

@Inject(['jsdiff'])
@RegisterPreferences(
  Schema.object({
    'quickDiff.preferredCompareMode': Schema.union([Schema.const('jsDiff'), Schema.const('mwApi')])
      .description('The preferred comparison mode for quick diff')
      .default('mwApi'),
    'quickDiff.jsDiff.defaultType': Schema.union(VALID_DIFF_TYPES.map((type) => Schema.const(type)))
      .description('The default diff type for JsDiff')
      .default('diffSentences'),
  }).description('Quick Diff Preferences'),
  {
    'quickDiff.preferredCompareMode': 'mwApi',
    'quickDiff.jsDiff.defaultType': 'diffSentences',
  }
)
export class PluginQuickDiffCore extends BasePlugin {
  VALID_DIFF_TYPES = VALID_DIFF_TYPES

  constructor(public ctx: InPageEdit) {
    super(ctx, {}, 'quick-diff')
  }

  protected start(): Promise<void> | void {
    this.ctx.set('quickDiff', this)
    this.ctx.on('quick-edit/wiki-page', this.injectQuickEdit.bind(this))
    window.RLQ.push(this.injectHistoryPage.bind(this))
  }

  protected stop(): Promise<void> | void {
    this.ctx.off('quick-edit/wiki-page', this.injectQuickEdit.bind(this))
  }

  private injectHistoryPage() {
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
          Quick Diff
        </button>
      )
    })
  }

  private injectQuickEdit({ modal, wikiPage }: QuickEditInitPayload) {
    if (wikiPage.pageid === 0) {
      // User is creating a new page, no need to show diff button
      return
    }
    let latestDiffModal: IPEModal | undefined = undefined
    modal.addButton(
      {
        label: 'Diff',
        side: 'left',
        className: 'btn btn-secondary',
        method: () => {
          const pageTitle = wikiPage.title
          const fromtext = wikiPage.revisions?.[0]?.content || ''
          const totext =
            (modal.get$content().querySelector<HTMLTextAreaElement>('textarea[name="text"]')
              ?.value as string) || ''

          latestDiffModal = this.comparePages(
            {
              fromtitle: pageTitle,
              fromtext,
              totitle: pageTitle,
              totext,
            },
            latestDiffModal
          )
          return latestDiffModal
        },
      },
      1
    )
  }

  simpleTextDiff(oldText: string, newText: string) {
    const modal = this.ctx.modal.show({
      title: 'Quick Diff',
      className: 'in-page-edit ipe-quickDiff',
    })
    modal.show()

    const container = <pre className={styles['diff-container']}></pre>
    const controller = (
      <div
        style={{
          display: 'flex',
          gap: '1em',
        }}
      >
        {this.VALID_DIFF_TYPES.map((type, index) => (
          <RadioBox
            name="diffType"
            value={type}
            label={type}
            inputProps={{
              checked: index === 0,
            }}
          />
        ))}
      </div>
    )
    modal.setContent(
      (
        <section>
          {controller}
          {container}
        </section>
      ) as HTMLElement
    )
    controller.querySelectorAll<HTMLInputElement>('input[name="diffType"]').forEach((input) => {
      input.addEventListener('change', () => {
        const diff = this.renderJsDiff(oldText, newText, input.value as JsDiffDiffType)
        container.textContent = ''
        container.appendChild(diff)
      })
    })
    controller
      .querySelector<HTMLInputElement>('input[name="diffType"]')!
      .dispatchEvent(new Event('change'))
  }

  /**
   * TODO: 类型体操
   */
  renderJsDiff(oldStr: string, newStr: string, diffType: JsDiffDiffType = 'diffSentences') {
    const fragment = document.createDocumentFragment()

    let diff: (ChangeObject<string> & { chunkHeader?: boolean })[]
    if (diffType === 'createTwoFilesPatch') {
      // 将 patch 结果转化为与 diffChars/diffWords... 类似的结构
      let pastHunkHeader = false
      diff = this.ctx.jsdiff
        .createTwoFilesPatch('original.txt', 'modified.txt', oldStr, newStr)
        .split('\n')
        .map(function (entry) {
          const line = {
            value: entry + '\n',
          } as ChangeObject<string> & { chunkHeader: boolean }
          if (entry.startsWith('@@')) {
            line.chunkHeader = true
            pastHunkHeader = true
          } else if (pastHunkHeader) {
            if (entry.startsWith('-')) {
              line.removed = true
            } else if (entry.startsWith('+')) {
              line.added = true
            }
          }
          return line
        })
    } else {
      const handler = this.ctx.jsdiff[diffType] as (
        oldStr: string,
        newStr: string
      ) => ChangeObject<string>[]
      if (!handler) {
        throw new Error(`Missing DiffEngine for ${diffType}`)
      }
      diff = handler(oldStr, newStr)
    }

    if (!Array.isArray(diff)) {
      throw new Error('Missing diff result')
    }

    // 交换逻辑（一个删除一个新增时）
    for (let i = 0; i < diff.length; i++) {
      if (diff[i].added && diff[i + 1] && diff[i + 1].removed) {
        const swap = diff[i]
        diff[i] = diff[i + 1]
        diff[i + 1] = swap
      }

      let node
      if (diff[i].removed) {
        node = document.createElement('del')
        node.appendChild(document.createTextNode(diff[i].value))
      } else if (diff[i].added) {
        node = document.createElement('ins')
        node.appendChild(document.createTextNode(diff[i].value))
      } else if (diff[i].chunkHeader) {
        node = document.createElement('span')
        node.setAttribute('class', 'chunk-header')
        node.appendChild(document.createTextNode(diff[i].value))
      } else {
        node = document.createTextNode(diff[i].value)
      }
      fragment.appendChild(node)
    }

    return fragment
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
    ].join('|'),
    difftype: 'table',
  }

  comparePages(options: Partial<CompareApiRequestOptions>, modal?: IPEModal) {
    if (!modal || modal.isDestroyed) {
      modal = this.ctx.modal
        .createObject({
          title: 'Loading diff...',
          content: '',
          className: 'quick-diff',
          backdrop: false,
          draggable: true,
        })
        .init()
    }

    modal.setContent(<ProgressBar />)
    modal.bringToFront()

    if (window.mw && mw.loader.getState('mediawiki.diff.styles') !== 'ready') {
      mw.loader.load(['mediawiki.diff.styles'])
    }

    this.ctx.api
      .post<MwApiResponse<CompareApiResponse>>({
        ...this.COMPARE_API_DEFAULT_OPTIONS,
        ...options,
        action: 'compare',
        format: 'json',
        formatversion: 2,
      })
      .then((res) => {
        if (res.data?.error || res.data?.errors) {
          const errors = [res.data?.error, ...(res.data?.errors || [])].filter(
            Boolean
          ) as MwApiError[]
          throw new Error(errors.map((err) => err.info).join('\n'), { cause: res })
        }
        if (!res.data.compare) {
          throw new Error('No compare data received', { cause: res })
        }
        const {
          data: { compare },
        } = res
        modal.setTitle(
          compare.fromtitle && compare.totitle
            ? `${compare.fromtitle} ⇔ ${compare.totitle}`
            : 'Differences'
        )
        modal.setContent(
          (
            <section>
              <DiffTable data={compare} />
            </section>
          ) as HTMLElement
        )
      })
      .catch((err) => {
        modal.setContent(
          (
            <MBox title="Failed to load diff" type="error">
              <pre>{err instanceof Error ? err.message : String(err)}</pre>
            </MBox>
          ) as HTMLElement
        )
      })

    return modal.show()
  }
}
