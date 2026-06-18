import { Inject, InPageEdit, Service } from '@/InPageEdit'
import { IWikiPage } from '@/models/WikiPage/index.js'
import { createWikiTitleModel, IWikiTitle, WikiTitleConstructor } from '@/models/WikiTitle/index.js'

declare module '@/InPageEdit' {
  interface InPageEdit {
    wikiTitle: WikiTitleService
  }
}

export interface WikiLinkMetadata {
  title?: IWikiTitle
  pageId?: number
  revId?: number
  url: URL
  params: URLSearchParams
  hash: string
  action: 'view' | 'edit' | 'create' | 'diff' | string
}

export class WikiTitleService extends Service {
  static readonly inject: Inject = ['wiki', 'wikiPage']

  readonly Title: WikiTitleConstructor
  constructor(public ctx: InPageEdit) {
    super(ctx, 'wikiTitle', true)
    this.Title = createWikiTitleModel(this.ctx.wiki.siteInfo)
  }
  private readonly logger = this.ctx.logger('WikiTitleService')

  newTitle(title: string | IWikiTitle, namespace?: number) {
    if (typeof title === 'string') {
      return new this.Title(title, namespace)
    } else {
      return title
    }
  }
  newMainPageTitle() {
    return this.newTitle(this.ctx.wiki.mainPageName)
  }
  async newTitleFromUrl(url: string | URL) {
    const linkInfo = this.parseWikiLink(url)
    if (linkInfo?.title) {
      return linkInfo.title
    } else if (linkInfo?.pageId) {
      return this.newTitleFromPageId(linkInfo.pageId)
    } else {
      return null
    }
  }
  private _cachedTitles = new Map<string, Promise<IWikiTitle | null>>()
  private async newTitleFromAnyId(
    payload: { title?: string; pageId?: number; revId?: number },
    noCache = false
  ) {
    const { title, pageId, revId } = payload ?? {}
    if (typeof title === 'string') {
      return this.newTitle(title)
    }
    let id: number | undefined = undefined
    let kind: 'pageid' | 'revid' | undefined = undefined
    if (revId) {
      id = parseInt(revId.toString(), 10)
      kind = 'revid'
    } else if (pageId) {
      id = parseInt(pageId.toString(), 10)
      kind = 'pageid'
    }
    if (!id || !kind || isNaN(id) || id <= 0) {
      throw new Error('Invalid id or kind', { cause: payload })
    }

    if (!noCache && this._cachedTitles.has(`${kind}:${id}`)) {
      return await this._cachedTitles.get(`${kind}:${id}`)!
    }
    const { promise, resolve, reject } = promiseWithResolvers<IWikiTitle | null>()
    this._cachedTitles.set(`${kind}:${id}`, promise)
    try {
      const { wikiPage } = this.ctx
      let page: IWikiPage | null = null
      if (kind === 'pageid') {
        page = await wikiPage.newFromPageId(id)
      } else if (kind === 'revid') {
        page = await wikiPage.newFromRevision(id)
      } else {
        throw new Error(`Invalid kind: ${kind}`)
      }
      resolve(this.newTitle(page.title))
    } catch (e) {
      this._cachedTitles.delete(`${kind}:${id}`)
      reject(e)
    }
    return promise
  }
  async newTitleFromPageId(pageId: number) {
    return this.newTitleFromAnyId({ pageId: pageId })
  }
  async newTitleFromRevision(revId: number) {
    return this.newTitleFromAnyId({ revId: revId })
  }

  /**
   * Resolve **special** special pages to it's real target
   *
   * If target is self or cannot be resolved, return null
   * @example
   * ```
   * Special:MyPage -> User:<username>
   * Special:Edit/Page_Title -> Page_Title
   * Special:NewSection/Page_Title -> Page_Title (section=new)
   * ```
   */
  resolveSpecialPageTarget(input: IWikiTitle | string): {
    title: IWikiTitle
    action?: string | undefined
    section?: number | 'new' | undefined
  } | null {
    const title = typeof input === 'string' ? this.newTitle(input) : input
    if (!title) {
      return null
    }
    if (title.getNamespaceId() !== -1) {
      return null
    }
    let titleText: string | undefined
    let section: number | 'new' | undefined = undefined
    let action = 'view'
    const sub = title.getMainDBKey().split('/').slice(1).join('/') || ''
    if (title.isSpecial('edit') && sub) {
      titleText = sub
      action = 'edit'
    } else if (title.isSpecial('talkpage') && sub) {
      const talkPage = title.newTitle(sub).getTalkPage()
      if (!talkPage) {
        return null
      }
      titleText = talkPage.getPrefixedDBKey()
    } else if (title.isSpecial('mypage')) {
      const userPage = title.newTitle(this.ctx.wiki.userInfo.name, 2)
      titleText = userPage.getPrefixedDBKey() + (sub ? `/${sub}` : '')
    } else if (title.isSpecial('mytalk')) {
      const userTalkPage = title.newTitle(this.ctx.wiki.userInfo.name, 3)
      titleText = userTalkPage.getPrefixedDBKey() + (sub ? `/${sub}` : '')
    } else if (title.isSpecial('newsection') && sub) {
      titleText = sub
      section = 'new'
      action = 'edit'
    } else {
      return null
    }

    return {
      title: new this.Title(titleText),
      section,
      action,
    }
  }

  // shortcuts
  private readonly wiki = this.ctx.wiki
  /**
   * @example "https://example.com"
   */
  private readonly wikiBaseUrl = this.wiki.baseUrl
  /**
   * Article path, with trailing slash
   * @example "/wiki/" (if wgArticlePath is "/wiki/$1")
   */
  private readonly wikiArticlePath = this.wiki.articlePath.replace('$1', '')
  /**
   * Article base URL, with trailing slash
   * @example "https://example.com/wiki/" (if wgArticlePath is "/wiki/$1")
   */
  private readonly wikiArticleBaseUrl = this.wiki.articleBaseUrl.replace('$1', '')
  /**
   * Script base URL, **without** trailing slash
   * @example "https://example.com/w" (if wgScriptPath is "/w")
   */
  private readonly wikiIndexPhpUrl = this.wiki.getSciprtUrl('index.php')

  isWikiLink(url: string): boolean {
    return (
      url.startsWith(this.wikiArticleBaseUrl) ||
      url.startsWith(this.wikiIndexPhpUrl) ||
      // Some servers allow index.php to be omitted
      url.startsWith(`${this.wikiBaseUrl}/?`) ||
      // It's the landing page
      url === this.ctx.wiki.landingPageUrl
    )
  }

  static readonly REG_SKIPPED_HREF = /^(#|javascript:|vbscript:|file:)/i
  validateHrefAttr(href: string | null): boolean {
    if (typeof href !== 'string') {
      return false
    }
    return !WikiTitleService.REG_SKIPPED_HREF.test(href)
  }

  parseWikiLink(link: string | URL): WikiLinkMetadata | null {
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
    let action = params.get('action') || 'view'
    if (
      params.get('veaction') === 'edit' ||
      params.get('veaction') === 'editsource'
    ) {
      action = 'edit'
    }
    const titleParam = params.get('title') || ''
    const curid = parseInt(params.get('curid') || '0', 10)
    const oldid = parseInt(params.get('oldid') || '0', 10)
    let titleText =
      titleParam ||
      (() => {
        try {
          return decodeURIComponent(url.pathname.substring(this.wikiArticlePath.length))
        } catch (e) {
          this.logger.error('parseLink', url, e)
          return ''
        }
      })()
    if (titleText.endsWith('index.php')) {
      titleText = ''
    }

    let title: IWikiTitle | undefined = undefined
    let pageId: number | undefined = undefined
    let revId: number | undefined = undefined
    // 此处的优先级遵循 MediaWiki 对 url 参数处理的优先级
    if (oldid) {
      revId = oldid
    } else if (curid) {
      pageId = curid
    } else if (titleText) {
      title = this.newTitle(titleText)
    } else {
      // 无任何有效参数
      if (url.origin + url.pathname === this.ctx.wiki.landingPageUrl) {
        // 但 url 是 landingPageUrl，则认为是主页
        title = this.newMainPageTitle()
      } else {
        return null
      }
    }

    return {
      title,
      pageId,
      revId,
      url,
      params,
      hash,
      action,
    }
  }
}
