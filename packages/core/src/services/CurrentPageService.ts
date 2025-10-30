import { Inject, InPageEdit, Service } from '@/InPageEdit.js'
import { IWikiTitle } from '@/models/WikiTitle'

declare module '@/InPageEdit.js' {
  interface InPageEdit {
    /**
     * Basic information of the current web page
     */
    currentPage: CurrentPageService
  }
}

@Inject(['wiki', 'wikiTitle'])
export class CurrentPageService extends Service {
  constructor(readonly ctx: InPageEdit) {
    super(ctx, 'currentPage', false)
  }
  private get logger() {
    return this.ctx.logger('CURRENT_PAGE')
  }

  protected async start() {
    await this.#init()

    this.#injectHistoryPopState()
    window.addEventListener('popstate', this.#onPopState.bind(this))

    this.logger.info('initialized', this.wikiTitle)
  }

  protected stop(): void | Promise<void> {
    window.removeEventListener('popstate', this.#onPopState.bind(this))
  }

  async #init() {
    await this.#initCurrentTitle()
    await this.#initIsMainPage()
  }

  #injectHistoryPopState() {
    const injectKey = Symbol.for('InPageEdit.CurrentPageService.UrlChangeListenerInstalled')
    if ((window as any)[injectKey]) {
      return
    }
    const _pushState = history.pushState
    const _replaceState = history.replaceState
    history.pushState = function (data: any, title: string, url?: string | null) {
      _pushState.apply(this, [data, title, url])
      window.dispatchEvent(new PopStateEvent('popstate', { state: data }))
    }
    history.replaceState = function (data: any, title: string, url?: string | null) {
      _replaceState.apply(this, [data, title, url])
      window.dispatchEvent(new PopStateEvent('popstate', { state: data }))
    }
    ;(window as any)[injectKey] = true
  }
  async #onPopState(e: PopStateEvent) {
    const oldURL = this.url
    const newURL = new URL(window.location.href)
    this.url = newURL

    // 只有 path/title=/curid= 变化时，才刷新状态
    if (
      oldURL.pathname !== newURL.pathname ||
      oldURL.searchParams.get('title') !== newURL.searchParams.get('title') ||
      oldURL.searchParams.get('curid') !== newURL.searchParams.get('curid')
    ) {
      await this.#init()
      this.logger.info('location changed', newURL, this.wikiTitle)
    }
  }

  url: URL = new URL(window.location.href)
  get params() {
    return this.url.searchParams
  }
  get canonicalUrl() {
    const href = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href
    let url: URL | null = null
    if (href) {
      url = new URL(href, location.origin)
    }
    Reflect.defineProperty(this, 'canonicalUrl', {
      get: () => url,
    })
    return url
  }

  readonly isMainPage!: boolean
  async #initIsMainPage() {
    const title = this.wikiTitle
    const isMainPage = title?.getMainDBKey() === this.ctx.wiki.mainPageName
    Reflect.defineProperty(this, 'isMainPage', {
      get: () => isMainPage,
    })
    return isMainPage
  }

  /**
   * Get the title of the current page by location URL
   * @returns IWikiTitle or null if cannot be determined
   */
  wikiTitle!: IWikiTitle | null
  async #initCurrentTitle(): Promise<IWikiTitle | null> {
    let title: IWikiTitle | null = null
    if (this.canonicalUrl) {
      title = await this.ctx.wikiTitle.newTitleFromUrl(this.canonicalUrl)
    } else {
      title = await this.ctx.wikiTitle.newTitleFromUrl(this.url)
    }
    Object.freeze(title)
    Reflect.defineProperty(this, 'wikiTitle', {
      get: () => title,
    })
    return title
  }

  get wikiAction() {
    return this.params.get('action') || 'view'
  }
}
