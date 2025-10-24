import { Inject, InPageEdit } from '@/InPageEdit'
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

@Inject(['sitemeta', 'wikiTitle'])
export class PluginInArticleLinks extends BasePlugin<{
  wikiBaseUrl: string
  wikiArticlePath: string
  wikiArticleBaseUrl: string
  wikiScriptBaseUrl: string
  linkClassName: string
}> {
  constructor(ctx: InPageEdit) {
    const mwConfig = ctx.sitemeta.mwConfig
    const wikiArticlePath = mwConfig.get('wgArticlePath', '').replace('$1', '')
    const wikiBaseUrl = `${location.protocol}//${mwConfig.get('wgServer', '').split('//')[1]}`
    super(
      ctx,
      {
        wikiBaseUrl,
        wikiArticlePath,
        wikiArticleBaseUrl: `${wikiBaseUrl}${wikiArticlePath}`,
        wikiScriptBaseUrl: `${wikiBaseUrl}${mwConfig.get('wgScriptPath', '')}`,
        linkClassName: 'ipe__in-article-link',
      },
      'InArticleLinks'
    )
    this.ctx.set('inArticleLinks', this)
  }

  protected async start() {
    // TODO: 这些都不应该硬编码，暂时先这样
    this.handleQuickEdit()
    this.handleQuickDiff()
  }

  protected async stop() {}

  static readonly REG_SKIPPED_HREF = /^(#|javascript:|vbscript:|file:)/i
  private validateHref(href: string | null): boolean {
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
    if (!this.validateHref(attrHref)) {
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

    if (typeof link === 'string' && !this.validateHref(link)) {
      return null
    }

    const url = typeof link === 'string' ? new URL(link, location.origin) : link
    const params = url.searchParams
    const hash = url.hash.replace('#', '')
    const action = params.get('action') || 'view'
    const titleText =
      params.get('title') ||
      decodeURI(url.pathname.substring(this.config.wikiArticlePath.length)) ||
      ''

    if (!titleText || titleText.endsWith('.php')) {
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

  handleQuickEdit() {
    let enable = false

    this.ctx.inject(['quickEdit'], (ctx) => {
      enable = true
      ctx.on('dispose', () => {
        enable = false
      })

      window?.mw?.hook?.('wikipage.content').add(($content) => {
        if (!enable) {
          return
        }
        const anchors = this.scanAnchors($content.get(0)!).filter(({ action, title }) => {
          return ['edit', 'create'].includes(action) || title.isSpecial('edit')
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
              <svg
                style="width: 1em; height: 1em"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="icon icon-tabler icons-tabler-outline icon-tabler-pencil-bolt"
              >
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" />
                <path d="M13.5 6.5l4 4" />
                <path d="M19 16l-2 3h4l-2 3" />
              </svg>
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
            ctx.quickDiff.comparePages(compare, undefined, {
              backdrop: true,
              draggable: false,
              center: false,
            })
          })
        })
      })
    })
  }
}
