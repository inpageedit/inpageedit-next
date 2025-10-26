import { Inject, InPageEdit, Schema } from '@/InPageEdit'
import { CompareApiRequestOptions } from '../quick-diff/PluginQuickDiffCore.js'
import { QuickEditOptions } from '../quick-edit/index.js'
import { WikiLinkMetadata } from '@/services/WikiTitleService.js'

declare module '@/InPageEdit' {
  interface InPageEdit {
    inArticleLinks: PluginInArticleLinks
  }
}

export interface InArticleWikiAnchorMetadata extends WikiLinkMetadata {
  $el: HTMLAnchorElement
  kind: 'normal' | 'mw:File'
  external: boolean
  redlink: boolean
}

@Inject(['wiki', 'wikiTitle', 'preferences'])
@RegisterPreferences(
  Schema.object({
    'inArticleLinks.enable': Schema.boolean()
      .description('Whether to enable in-article links')
      .default(true),
    'inArticleLinks.quickDiff.enable': Schema.boolean()
      .description('Whether to enable in-article links for quick diff')
      .default(true),
    'inArticleLinks.quickEdit.enable': Schema.boolean()
      .description('Whether to enable in-article links for quick edit')
      .default(true),
    'inArticleLinks.quickEdit.redlinks': Schema.boolean()
      .description('Whether to show quick edit button for redlinks')
      .default(true),
  })
    .description('In-article links preferences')
    .extra('category', 'in-article-links')
)
export class PluginInArticleLinks extends BasePlugin<{
  linkClassName: string
}> {
  constructor(ctx: InPageEdit) {
    super(
      ctx,
      {
        linkClassName: 'ipe__in-article-link',
      },
      'InArticleLinks'
    )
    this.ctx.set('inArticleLinks', this)

    this.ctx.preferences.defineCategory({
      label: 'In Article Links',
      name: 'in-article-links',
      description: 'In-article links preferences',
      index: 9,
    })
  }

  protected async start() {
    // TODO: 这些都不应该硬编码，暂时先这样
    if (await this.ctx.preferences.get<boolean>('inArticleLinks.quickEdit.enable')) {
      this.handleQuickEdit()
    }
    if (await this.ctx.preferences.get<boolean>('inArticleLinks.quickDiff.enable')) {
      this.handleQuickDiff()
    }
  }

  protected async stop() {}

  private _cachedAnchorInfo = new WeakMap<HTMLAnchorElement, InArticleWikiAnchorMetadata>()
  parseAnchor(anchor: HTMLAnchorElement): InArticleWikiAnchorMetadata | null {
    // 不是链接元素
    if (!(anchor instanceof HTMLAnchorElement)) {
      return null
    }

    const cached = this._cachedAnchorInfo.get(anchor)
    if (cached) {
      return cached
    }

    const attrHref = anchor.getAttribute('href') || ''
    if (!this.ctx.wikiTitle.validateHrefAttr(attrHref)) {
      return null
    }
    const href = anchor.href || ''
    const linkInfo = this.ctx.wikiTitle.parseWikiLink(href)
    if (!linkInfo) {
      return null
    }

    const info: InArticleWikiAnchorMetadata = {
      $el: anchor,
      kind: anchor.closest('[typeof^="mw:File"]') ? 'mw:File' : 'normal',
      external: anchor.classList.contains('external') || !!attrHref.startsWith('http'),
      redlink: anchor.classList.contains('new') || linkInfo.params.has('redlink'),
      ...linkInfo,
    }
    this._cachedAnchorInfo.set(anchor, info)
    return info
  }

  scanAnchors(
    parent: HTMLElement,
    filter?: (info: InArticleWikiAnchorMetadata) => boolean
  ): InArticleWikiAnchorMetadata[] {
    const anchors = parent.querySelectorAll<HTMLAnchorElement>('a[href]')
    return Array.from(anchors)
      .map((anchor) => this.parseAnchor(anchor))
      .filter(
        (anchor) => anchor !== null && (!filter || filter(anchor))
      ) as InArticleWikiAnchorMetadata[]
  }

  async handleQuickEdit() {
    let enable = false
    const showButtonOnRedlinks = await this.ctx.preferences.get<boolean>(
      'inArticleLinks.quickEdit.redlinks'
    )

    this.ctx.inject(['quickEdit'], (ctx) => {
      enable = true
      ctx.on('dispose', () => {
        enable = false
      })

      window?.mw?.hook?.('wikipage.content').add(($content) => {
        if (!enable) {
          return
        }
        const anchors = this.scanAnchors($content.get(0)!, ({ action, title, redlink }) => {
          return (
            !!(
              ['edit', 'create'].includes(action) ||
              title?.isSpecial('edit') ||
              title?.isSpecial('newsection')
            ) &&
            // 添加对showButtonOnRedlinks的判断
            (showButtonOnRedlinks || !redlink)
          )
        })
        anchors.forEach(({ $el, title, pageId, params }) => {
          if ($el.dataset.ipeEditMounted) {
            return
          }
          $el.dataset.ipeEditMounted = '1'

          const notCompatible = params.has('preload') || params.has('redo')
          if (notCompatible) {
            return this.ctx.logger.debug($el, `Not compatible with quick edit`)
          }

          const titleText = title?.getPrefixedDBKey() || ''
          const sectionRaw = params.get('section')?.replace(/^T-/, '') || undefined
          const revisionRaw = params.get('oldid')
          const createOnly = params.has('redlink')

          let section: 'new' | number | undefined = undefined
          if (sectionRaw === 'new') {
            section = 'new'
          } else if (sectionRaw && /^\d+$/.test(sectionRaw)) {
            section = parseInt(sectionRaw, 10)
          }

          const revision = revisionRaw ? parseInt(revisionRaw, 10) : undefined

          const payload: Partial<QuickEditOptions> = {
            title: titleText,
            pageId: pageId || undefined,
            section,
            revision,
            createOnly,
          }

          const link = (
            <a
              href={`#ipe://quick-edit/`}
              dataset={payload as any}
              className={`${this.config.linkClassName} ipe-quick-edit ${createOnly ? 'ipe-quick-edit--create-only' : ''}`}
              style={{
                userSelect: 'none',
                marginLeft: '0.2em',
              }}
              onClick={(e) => {
                e.preventDefault()
                ctx.quickEdit.showModal(payload)
              }}
            >
              <IconQuickEdit className="ipe-icon" />
            </a>
          )

          $el.insertAdjacentElement('afterend', link)
        })
      })
    })
  }

  handleQuickDiff() {
    let enable = false
    const isRelative = (str: string): str is 'prev' | 'next' | 'cur' =>
      ['prev', 'next', 'cur'].includes(str)

    this.ctx.inject(['quickDiff'], (ctx) => {
      enable = true
      ctx.on('dispose', () => {
        enable = false
      })

      window?.mw?.hook?.('wikipage.content').add(($content) => {
        if (!enable) {
          return
        }
        const anchors = this.scanAnchors($content.get(0)!, ({ params, title }) => {
          return !!(params.has('diff') || title?.isSpecial('diff'))
        })
        anchors.forEach(({ $el, title, params }) => {
          if ($el.dataset.ipeDiffMounted) {
            return
          }
          $el.dataset.ipeDiffMounted = '1'

          let diff: string | null
          let oldid: string | null
          if (title?.getNamespaceId() === -1) {
            // prettier-ignore
            ;[/** special page name */, diff, oldid] = title.getMainDBKey().split('/')
          } else {
            diff = params.get('diff')
            oldid = params.get('oldid')
          }
          if (!diff || !oldid) {
            return
          }

          const compare: Partial<CompareApiRequestOptions> = {}
          if (isRelative(diff)) {
            compare.fromrev = parseInt(oldid)
            compare.torelative = diff
          } else {
            compare.fromrev = parseInt(oldid)
            compare.torev = parseInt(diff)
          }

          const link = (
            <a
              href={`#ipe://quick-diff/`}
              dataset={compare as any}
              className={`${this.config.linkClassName} ipe-quick-diff`}
              style={{
                userSelect: 'none',
                marginLeft: '0.2em',
              }}
              onClick={(e) => {
                e.preventDefault()
                ctx.quickDiff.comparePages(compare)
              }}
            >
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
                class="icon icon-tabler icons-tabler-outline icon-tabler-file-diff ipe-icon"
              >
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                <path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" />
                <path d="M12 10l0 4" />
                <path d="M10 12l4 0" />
                <path d="M10 17l4 0" />
              </svg>
            </a>
          )

          $el.insertAdjacentElement('afterend', link)
        })
      })
    })
  }
}
