import { Inject, InPageEdit, Service } from '@/InPageEdit'
import { createWikiTitleModel, IWikiTitle, WikiTitleConstructor } from '@/models/WikiTitle/index.js'

declare module '@/InPageEdit' {
  interface InPageEdit {
    wikiTitle: WikiTitleService
  }
}

export interface WikiLinkMetadata {
  title: IWikiTitle
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
  newTitleFromUrl(url: string | URL) {
    const linkInfo = this.parseWikiLink(url)
    return linkInfo?.title || null
  }
  get currentIsMainPage() {
    let isMainPage = false
    const fullPath = window?.location?.origin + window?.location?.pathname
    let paramTitle = new URLSearchParams(window?.location?.search || '').get('title')
    if (paramTitle) {
      paramTitle = paramTitle[0].toUpperCase() + paramTitle.slice(1)
      paramTitle = paramTitle.replace(/_/g, ' ')
    }
    if (fullPath === this.wiki.getSciprtUrl('index.php') && paramTitle === this.wiki.mainPageName) {
    }
    const mainpageUrls = [this.wiki.mainPageUrl, this.wiki.landingPageUrl]
    isMainPage = mainpageUrls.includes(fullPath)
    Reflect.defineProperty(this, 'currentIsMainPage', {
      value: isMainPage,
      writable: false,
      configurable: false,
      enumerable: true,
    })
    return isMainPage
  }
  /**
   * Get the title of the current page by location URL
   * @returns IWikiTitle or null if cannot be determined
   */
  get currentTitle() {
    const title = this.currentIsMainPage
      ? this.newTitle(this.wiki.mainPageName)
      : this.newTitleFromUrl(window?.location?.href)
    if (title) {
      Object.freeze(title)
      Reflect.defineProperty(this, 'currentTitle', {
        value: title,
        writable: false,
        configurable: false,
        enumerable: true,
      })
      return title
    } else {
      return null
    }
  }
  get currentAction() {
    const params = new URLSearchParams(window?.location?.search || '')
    const action = params.get('action') || 'view'
    Reflect.defineProperty(this, 'currentAction', {
      value: () => action,
      writable: false,
      configurable: false,
      enumerable: true,
    })
    return action
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
    return url.startsWith(this.wikiArticleBaseUrl) || url.startsWith(this.wikiIndexPhpUrl)
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
    const titleText = url.pathname.endsWith('.php')
      ? params.get('title')
      : (() => {
          try {
            return decodeURI(url.pathname.substring(this.wikiArticlePath.length))
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
      title: this.newTitle(titleText),
    }
  }
}
