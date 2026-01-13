import { Inject, InPageEdit, Service } from '@/InPageEdit.js'
import { IWikiTitle } from '@/models/WikiTitle'

declare module '@/InPageEdit.js' {
  interface InPageEdit {
    /**
     * Basic information of the current web page
     */
    currentPage: CurrentPageService
  }
  interface Events {
    'current-page/popstate'(): void
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

  static readonly HISTORY_CHANGE_EVENT = 'inpageedit:historychange'
  static readonly POPSTATE_INJECTION_KEY: symbol = Symbol.for(
    'inpageedit:currentpage:popstateinjection'
  )

  protected async start() {
    await this.#init()

    this.#injectHistoryPopState()
    window.addEventListener(CurrentPageService.HISTORY_CHANGE_EVENT, this.#boundOnLocationChange)
    this.ctx.emit('current-page/popstate')

    this.logger.info('initialized', this.wikiTitle)
  }

  protected stop(): void | Promise<void> {
    window.removeEventListener(CurrentPageService.HISTORY_CHANGE_EVENT, this.#boundOnLocationChange)
  }

  async #init() {
    await this.#initCurrentTitle()
    await this.#initIsMainPage()
  }

  /**
   * @NOTE
   * Do not use event name 'popstate' to listen to history change,
   * because it will cause conflict with some SPA frameworks (e.g. vue-router).
   */
  #injectHistoryPopState() {
    const injectionKey = CurrentPageService.POPSTATE_INJECTION_KEY
    if ((window as any)[injectionKey]) {
      return
    }
    const _pushState = history.pushState
    const _replaceState = history.replaceState
    history.pushState = function (data: any, title: string, url?: string | null) {
      _pushState.apply(this, [data, title, url])
      window.dispatchEvent(new CustomEvent(CurrentPageService.HISTORY_CHANGE_EVENT))
    }
    history.replaceState = function (data: any, title: string, url?: string | null) {
      _replaceState.apply(this, [data, title, url])
      window.dispatchEvent(new CustomEvent(CurrentPageService.HISTORY_CHANGE_EVENT))
    }
    ;(window as any)[injectionKey] = true
  }

  async #onLocationChange() {
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
      this.ctx.emit('current-page/popstate')
      this.logger.info('location changed', newURL, this.wikiTitle)
    }
  }
  readonly #boundOnLocationChange = this.#onLocationChange.bind(this)

  url: URL = new URL(window.location.href)
  get params() {
    return this.url.searchParams
  }
  get canonicalUrl() {
    const href = (
      qs<HTMLLinkElement>('link[rel="alternate"][hreflang="x-default"]') ||
      qs<HTMLLinkElement>('link[rel="canonical"]')
    )?.href
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
