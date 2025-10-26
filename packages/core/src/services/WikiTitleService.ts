import { Inject, InPageEdit, Service } from '@/InPageEdit'
import { createWikiTitleModel, IWikiTitle, WikiTitleConstructor } from '@/models/WikiTitle/index.js'

declare module '@/InPageEdit' {
  interface InPageEdit {
    wikiTitle: WikiTitleService
  }
}

export interface WikiLinkMetadata {
  title: IWikiTitle | null
  pageId: number | null
  url: URL
  params: URLSearchParams
  hash: string
  action: 'view' | 'edit' | 'create' | 'diff' | string
}

export class WikiTitleService extends Service {
  static readonly inject: Inject = ['wiki']

  readonly Title: WikiTitleConstructor
  constructor(public ctx: InPageEdit) {
    super(ctx, 'wikiTitle', true)
    this.Title = createWikiTitleModel(this.ctx.wiki._raw)
  }
  private readonly logger = this.ctx.logger('WikiTitleService')

  newTitle(title: string, namespace?: number) {
    return new this.Title(title, namespace)
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
  private _titleByPageId = new Map<number, Promise<IWikiTitle | null>>()
  async newTitleFromPageId(pageId: number) {
    pageId = parseInt(pageId as any, 10)
    if (isNaN(pageId) || pageId <= 0) {
      return null
    }
    if (this._titleByPageId.has(pageId)) {
      return this._titleByPageId.get(pageId)!
    }
    const { promise, resolve, reject } = promiseWithResolvers<IWikiTitle | null>()
    this._titleByPageId.set(pageId, promise)
    this.ctx.inject(['wikiPage'], async (ctx) => {
      try {
        const page = await ctx.wikiPage.newFromPageId(pageId)
        resolve(this.newTitle(page.title))
      } catch (e) {
        this._titleByPageId.delete(pageId)
        reject(e)
      }
    })
    return promise
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
      url.startsWith(`${this.wikiBaseUrl}/?`)
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
    const action = params.get('action') || 'view'
    const titleParam = params.get('title') || ''
    const curid = parseInt(params.get('curid') || '0', 10)
    let titleText =
      titleParam ||
      (() => {
        try {
          return decodeURI(url.pathname.substring(this.wikiArticlePath.length))
        } catch (e) {
          this.logger.error('parseLink', url, e)
          return ''
        }
      })()
    if (titleText.endsWith('index.php')) {
      titleText = ''
    }

    let title: IWikiTitle | null = null
    let pageId: number | null = null
    if (curid) {
      pageId = curid
    } else if (titleText) {
      title = this.newTitle(titleText)
    } else {
      return null
    }

    return {
      title,
      pageId,
      url,
      params,
      hash,
      action,
    }
  }
}
