import { Inject, InPageEdit, Schema } from '@/InPageEdit'
import { IWikiTitle } from '@/models/WikiTitle/index.js'
import { CompareApiRequestOptions } from '../quick-diff/PluginQuickDiffCore.js'
import { QuickEditOptions } from '../quick-edit/index.js'

declare module '@/InPageEdit' {
  interface InPageEdit {
    inArticleLinks: PluginInArticleLinks
  }
}

export interface InArticleWikiLinkInfo {
  title: IWikiTitle
  url: URL
  params: URLSearchParams
  hash: string
  action: 'view' | 'edit' | 'create' | 'diff' | string
}

export interface InArticleWikiAnchorInfo extends InArticleWikiLinkInfo {
  $el: HTMLAnchorElement
  kind: 'normal' | 'mw:File'
  external: boolean
  redlink: boolean
}

@Inject(['sitemeta', 'wikiTitle', 'preferences'])
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
  /**
   * @example "https://example.com"
   */
  wikiBaseUrl: string
  /**
   * Article path, with trailing slash
   * @example "/wiki/" (if wgArticlePath is "/wiki/$1")
   */
  wikiArticlePath: string
  /**
   * Article base URL, with trailing slash
   * @example "https://example.com/wiki/" (if wgArticlePath is "/wiki/$1")
   */
  wikiArticleBaseUrl: string
  /**
   * Script base URL, **without** trailing slash
   * @example "https://example.com/w" (if wgScriptPath is "/w")
   */
  wikiScriptBaseUrl: string
  linkClassName: string
}> {
  constructor(ctx: InPageEdit) {
    super(
      ctx,
      {
        wikiBaseUrl: ctx.sitemeta.baseUrl,
        wikiArticlePath: ctx.sitemeta.articlePath.replace('$1', ''),
        wikiArticleBaseUrl: ctx.sitemeta.articleBaseUrl.replace('$1', ''),
        wikiScriptBaseUrl: ctx.sitemeta.scriptBaseUrl,
        linkClassName: 'ipe__in-article-link',
      },
      'InArticleLinks'
    )
    this.ctx.set('inArticleLinks', this)

    this.ctx.preferences.defineCategory({
      label: 'In Article Links',
      name: 'in-article-links',
      description: 'In-article links preferences',
      index: 1,
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

  isWikiLink(url: string): boolean {
    return (
      url.startsWith(this.config.wikiArticleBaseUrl) ||
      url.startsWith(this.config.wikiScriptBaseUrl + '/index.php')
    )
  }

  static readonly REG_SKIPPED_HREF = /^(#|javascript:|vbscript:|file:)/i
  private validateHrefAttr(href: string | null): boolean {
    if (typeof href !== 'string') {
      return false
    }
    return !PluginInArticleLinks.REG_SKIPPED_HREF.test(href)
  }

  private _cachedAnchorInfo = new WeakMap<HTMLAnchorElement, InArticleWikiAnchorInfo>()
  parseAnchor(anchor: HTMLAnchorElement): InArticleWikiAnchorInfo | null {
    // 不是链接元素
    if (!(anchor instanceof HTMLAnchorElement)) {
      return null
    }

    const cached = this._cachedAnchorInfo.get(anchor)
    if (cached) {
      return cached
    }

    const attrHref = anchor.getAttribute('href') || ''
    if (!this.validateHrefAttr(attrHref)) {
      return null
    }
    const href = anchor.href || ''
    const linkInfo = this.parseLink(href)
    if (!linkInfo) {
      return null
    }

    const info: InArticleWikiAnchorInfo = {
      $el: anchor,
      kind: anchor.closest('[typeof^="mw:File"]') ? 'mw:File' : 'normal',
      external: anchor.classList.contains('external') || !!attrHref.startsWith('http'),
      redlink: anchor.classList.contains('new') || linkInfo.params.has('redlink'),
      ...linkInfo,
    }
    this._cachedAnchorInfo.set(anchor, info)
    return info
  }

  parseLink(link: string | URL): InArticleWikiLinkInfo | null {
    if (!link) {
      return null
    }

    if (typeof link === 'string' && !this.validateHrefAttr(link)) {
      return null
    }

    const url = makeURL(link)
    if (!this.isWikiLink(url.toString())) {
      return null
    }

    const params = url.searchParams
    const hash = url.hash.replace('#', '')
    const action = params.get('action') || 'view'
    const titleText = url.pathname.endsWith('.php')
      ? params.get('title')
      : (() => {
          try {
            return decodeURI(url.pathname.substring(this.config.wikiArticlePath.length))
          } catch (e) {
            this.logger.error('parseLink', url, e)
            return null
          }
        })()

    if (!titleText) {
      return null
    }

    return {
      url,
      params,
      hash,
      action,
      title: this.ctx.wikiTitle.create(titleText),
    }
  }

  scanAnchors(parent: HTMLElement): InArticleWikiAnchorInfo[] {
    const anchors = parent.querySelectorAll<HTMLAnchorElement>('a[href]')
    return Array.from(anchors)
      .map((anchor) => this.parseAnchor(anchor))
      .filter((anchor) => anchor !== null)
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
        const anchors = this.scanAnchors($content.get(0)!).filter(({ action, title, redlink }) => {
          return (
            (['edit', 'create'].includes(action) || title.isSpecial('edit')) &&
            // 添加对showButtonOnRedlinks的判断
            (showButtonOnRedlinks || !redlink)
          )
        })
        anchors.forEach(({ $el, title, params }) => {
          if ($el.dataset.ipeEditMounted) {
            return
          }
          $el.dataset.ipeEditMounted = '1'

          const notCompatible = params.has('preload') || params.has('redo')
          if (notCompatible) {
            return this.ctx.logger.debug($el, `Not compatible with quick edit`)
          }

          let titleText: string
          if (title.getNamespaceId() === -1) {
            const sub = title.getMainDBKey().split('/').slice(1).join('/') || ''
            if (title.isSpecial('edit')) {
              titleText = sub
            } else if (title.isSpecial('talkpage')) {
              const talkPage = title.newTitle(sub).getTalkPage()
              if (!talkPage) {
                return this.ctx.logger.debug($el, `Talk page not found.`)
              }
              titleText = talkPage.getPrefixedDBKey()
            } else if (title.isSpecial('mypage')) {
              const userPage = title.newTitle(this.ctx.sitemeta.userInfo.name, 2)
              titleText = userPage.getPrefixedDBKey() + (sub ? `/${sub}` : '')
            } else if (title.isSpecial('mytalk')) {
              const userTalkPage = title.newTitle(this.ctx.sitemeta.userInfo.name, 3)
              titleText = userTalkPage.getPrefixedDBKey() + (sub ? `/${sub}` : '')
            } else {
              return this.ctx.logger.debug($el, `Special page cannot be edited`)
            }
          } else {
            titleText = title.getPrefixedDBKey()
          }

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
                verticalAlign: 'middle',
              }}
              onClick={(e) => {
                e.preventDefault()
                ctx.quickEdit.showModal(payload)
              }}
            >
              <IconQuickEdit style="width: 1em; height: 1em" />
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
        const anchors = this.scanAnchors($content.get(0)!).filter(({ params, title }) => {
          return params.has('diff') || title.isSpecial('diff')
        })
        anchors.forEach(({ $el, title, params }) => {
          if ($el.dataset.ipeDiffMounted) {
            return
          }
          $el.dataset.ipeDiffMounted = '1'

          let diff: string | null
          let oldid: string | null
          if (title.getNamespaceId() === -1) {
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

          $el.addEventListener('click', (e) => {
            e.preventDefault()
            ctx.quickDiff.comparePages(compare)
          })
        })
      })
    })
  }
}
