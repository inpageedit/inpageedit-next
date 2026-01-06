import { Inject, InPageEdit, Schema } from '@/InPageEdit'
import { CompareApiRequestOptions } from '../quick-diff/index.js'
import { QuickEditOptions } from '../quick-edit/index.js'
import { WikiLinkMetadata } from '@/services/WikiTitleService.js'

declare module '@/InPageEdit' {
  interface InPageEdit {
    inArticleLinks: PluginInArticleLinks
  }
  interface Events {
    'in-article-links/anchor-parsed'(payload: {
      ctx: InPageEdit
      anchor: HTMLAnchorElement
      info: InArticleWikiAnchorMetadata
    }): void
    'in-article-links/anchor-clicked'(payload: {
      ctx: InPageEdit
      anchor: HTMLAnchorElement
      info: InArticleWikiAnchorMetadata
      event: MouseEvent
      action: 'quickEdit' | 'quickDiff'
    }): void
  }
  interface PreferencesMap {
    'inArticleLinks.quickEdit.enable': boolean
    'inArticleLinks.quickDiff.enable': boolean
    'inArticleLinks.quickEdit.redlinks': boolean
  }
}

export interface InArticleWikiAnchorMetadata extends WikiLinkMetadata {
  $el: HTMLAnchorElement
  kind: 'normal' | 'mw:File'
  external: boolean
  redlink: boolean
}

@Inject(['wiki', 'wikiTitle', 'preferences', '$'])
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
    const { $ } = this.ctx

    this.ctx.preferences.defineCategory({
      name: 'in-article-links',
      label: $`prefs.inArticleLinks.label`,
      description: $`prefs.inArticleLinks.$`,
      index: 9,
    })
  }

  protected async start() {
    // TODO: 这些都不应该硬编码，暂时先这样
    if (await this.ctx.preferences.get('inArticleLinks.quickEdit.enable')) {
      this.handleQuickEdit()
    }
    if (await this.ctx.preferences.get('inArticleLinks.quickDiff.enable')) {
      this.handleQuickDiff()
    }
  }

  protected async stop() {
    Array.from(
      document.getElementsByClassName(this.config.linkClassName) as HTMLCollectionOf<HTMLElement>
    ).forEach((el) => {
      el.remove()
    })
    document.querySelectorAll<HTMLElement>('[data-ipe-edit-mounted]').forEach((el) => {
      el.dataset.ipeEditMounted = undefined
    })
  }

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
    this.ctx.emit('in-article-links/anchor-parsed', {
      ctx: this.ctx,
      anchor,
      info,
    })
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

  private onContentReady(callback: ($content: JQuery<HTMLElement>) => void) {
    const register = () => {
      if (!window.mw) return
      window.mw.hook('wikipage.content').add(callback)
      const $content = (window as any).$?.('#mw-content-text')
      if ($content?.length) callback($content)
    }

    if (window.mw && typeof window.mw.hook === 'function') {
      register()
    } else {
      window.RLQ = window.RLQ || ([] as any)
      window.RLQ.push(['mediawiki.base', register])
    }
  }

  async handleQuickEdit() {
    let enable = false
    const showButtonOnRedlinks = await this.ctx.preferences.get('inArticleLinks.quickEdit.redlinks')

    this.ctx.inject(['quickEdit'], (ctx) => {
      enable = true
      ctx.on('dispose', () => {
        enable = false
      })

      this.onContentReady(($content) => {
        if (!enable || !$content?.length) {
          return
        }
        const anchors = this.scanAnchors($content.get(0)!, ({ action, title, redlink }) => {
          const enabled = showButtonOnRedlinks || !redlink
          if (!enabled) {
            return false
          }
          const isActionEdit = ['edit', 'create'].includes(action)
          if (isActionEdit) {
            return true
          }
          const isSpecialEdit = title?.isSpecial('edit') || title?.isSpecial('newsection')
          if (isSpecialEdit) {
            return title!.getMainText().split('/').length >= 2
          }
          return false
        })
        anchors.forEach((info) => {
          const { $el, title, pageId, params } = info
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
          if (sectionRaw === 'new' || title?.isSpecial('newsection')) {
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

          const link = ctx.quickEdit.createQuickEditButton(payload, { label: '' })
          link.classList.add(this.config.linkClassName)
          link.addEventListener('click', (e) => {
            this.ctx.emit('in-article-links/anchor-clicked', {
              ctx: this.ctx,
              anchor: $el,
              info,
              event: e,
              action: 'quickEdit',
            })
          })

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

      this.onContentReady(($content) => {
        if (!enable || !$content?.length) {
          return
        }
        const anchors = this.scanAnchors($content.get(0)!, ({ params, title }) => {
          return !!(params.has('diff') || title?.isSpecial('diff'))
        })
        anchors.forEach((info) => {
          const { $el, title, params } = info
          if ($el.dataset.ipeDiffMounted) {
            return
          }
          $el.dataset.ipeDiffMounted = '1'

          let diff: string | null
          let oldid: string | null
          if (title?.getNamespaceId() === -1) {
            // prettier-ignore
            ;[/** special page name */, oldid, diff] = title.getMainDBKey().split('/')
            if (!diff) {
              diff = 'prev'
            }
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

          const link = this.ctx.quickDiff.createQuickDiffButton(compare, { label: '' })
          link.classList.add(this.config.linkClassName)
          link.addEventListener('click', (e) => {
            this.ctx.emit('in-article-links/anchor-clicked', {
              ctx: this.ctx,
              anchor: $el,
              info,
              event: e,
              action: 'quickDiff',
            })
          })

          $el.insertAdjacentElement('afterend', link)
        })
      })
    })
  }
}
