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
  private readonly logger = this.ctx.logger('CURRENT_PAGE')

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
    await this.#initIsMainPage()
    await this.#initCurrentTitle()
    await this.#initCurrentAction()
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

  readonly isMainPage!: boolean
  async #initIsMainPage() {
    let isMainPage = false
    const fullPath = this.url.origin + this.url.pathname
    let paramTitle = this.params.get('title') || ''
    const paramCurid = parseInt(this.params.get('curid') || '0', 10)
    if (paramCurid) {
      const page = await this.ctx.wikiPage.newFromPageId(paramCurid)
      paramTitle = page?.title || ''
    } else if (paramTitle) {
      paramTitle = paramTitle[0].toUpperCase() + paramTitle.slice(1)
      paramTitle = paramTitle.replace(/_/g, ' ')
    }
    if (
      fullPath === this.ctx.wiki.getSciprtUrl('index.php') &&
      paramTitle === this.ctx.wiki.mainPageName
    ) {
      isMainPage = true
    }
    const mainpageUrls = [this.ctx.wiki.mainPageUrl, this.ctx.wiki.landingPageUrl]
    isMainPage = mainpageUrls.includes(fullPath) && !paramTitle
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
    const isMainPage = this.isMainPage
    if (isMainPage) {
      title = this.ctx.wikiTitle.newTitle(this.ctx.wiki.mainPageName)
    } else {
      title = await this.ctx.wikiTitle.newTitleFromUrl(this.url)
    }
    Object.freeze(title)
    Reflect.defineProperty(this, 'wikiTitle', {
      get: () => title,
    })
    return title
  }

  readonly wikiAction!: string
  async #initCurrentAction() {
    const action = this.params.get('action') || 'view'
    Reflect.defineProperty(this, 'wikiAction', {
      get: () => action,
    })
    return this.wikiAction
  }
}
