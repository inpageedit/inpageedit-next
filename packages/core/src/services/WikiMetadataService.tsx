import { Inject, InPageEdit, Schema, Service } from '@/InPageEdit'
import { WikiSiteInfo, WikiUserBlockInfo, WikiUserInfo } from '@/types/WikiMetadata'
import { AbstractIPEStorageManager } from './storage'
import { MwApiParams } from 'wiki-saikou'

declare module '@/InPageEdit' {
  interface InPageEdit {
    wiki: WikiMetadataService
    getUrl: WikiMetadataService['getUrl']
    getSciprtUrl: WikiMetadataService['getSciprtUrl']
    getMainpageUrl: WikiMetadataService['getMainpageUrl']
  }
}

interface WikiMetadataKindMap {
  siteinfo: WikiSiteInfo
  userinfo: WikiUserInfo
}

@Inject(['api', 'storage'])
export class WikiMetadataService extends Service {
  private readonly _data: WikiMetadataKindMap = {} as any
  private readonly CACHE_VERSION = 3
  private readonly CACHE_TTL: Readonly<Record<keyof WikiMetadataKindMap, number>> = {
    siteinfo: 1000 * 60 * 60 * 24 * 3, // 3 days
    userinfo: 1000 * 60 * 30, // 30 minutes
  }
  private readonly QUERY_DATA: Readonly<Record<keyof WikiMetadataKindMap, MwApiParams>> = {
    siteinfo: {
      meta: 'siteinfo',
      siprop: 'general|specialpagealiases|namespacealiases|namespaces|magicwords',
    },
    userinfo: { meta: 'userinfo', uiprop: 'groups|rights|blockinfo|options' },
  }
  private readonly CACHE_DB: AbstractIPEStorageManager<
    WikiMetadataKindMap[keyof WikiMetadataKindMap]
  >

  constructor(public ctx: InPageEdit) {
    super(ctx, 'wiki', false)
    this.CACHE_DB = ctx.storage.createDatabse<WikiMetadataKindMap[keyof WikiMetadataKindMap]>(
      'wiki-metadata',
      Infinity,
      this.CACHE_VERSION
    )
  }

  private get logger() {
    return this.ctx.logger('WIKI_METADATA')
  }

  private get api() {
    return this.ctx.api
  }

  readonly mwConfig = {
    get: ((key: string, fallback?: any) => {
      return window?.mw?.config?.get?.(key, fallback) ?? fallback
    }) as typeof mw.config.get,
    has: ((key: string) => {
      return window?.mw?.config?.exists?.(key) ?? false
    }) as typeof mw.config.exists,
    get values() {
      return ((window?.mw?.config as any)?.values || {}) as ReturnType<typeof mw.config.get>
    },
  }

  protected async start(): Promise<void> {
    await Promise.all(
      Object.keys(this.QUERY_DATA).map((key) => this.initData(key as keyof WikiMetadataKindMap))
    )

    this.ctx.set('getUrl', this.getUrl.bind(this))
    this.ctx.set('getSciprtUrl', this.getSciprtUrl.bind(this))
    this.ctx.set('getMainpageUrl', this.getMainpageUrl.bind(this))

    this.ctx.inject(['preferences'], (ctx) => {
      ctx.preferences.registerCustomConfig(
        'WikiMetadataService',
        Schema.object({
          WikiMetadataService: Schema.const(
            <div>
              <h3>Wiki Informations</h3>
              <ul>
                <li>
                  <strong>Site:</strong> {this.general.sitename} ({this.landingPageUrl})
                </li>
                <li>
                  <strong>User</strong>: {this.userInfo.name} (ID: {this.userInfo.id})
                </li>
                <li>
                  <strong>Groups</strong>: {this.userGroups.join(', ') || 'None'}
                </li>
              </ul>
              <div>
                <p style={{ fontStyle: 'italic' }}>
                  If the information shown above is incorrect (for example, the user is not you),
                  click the button below.
                </p>
                <button
                  className="btn danger"
                  onClick={(e) => {
                    e.preventDefault()
                    Promise.all(
                      Object.keys(this.QUERY_DATA).map((key) =>
                        this.invalidateCache(key as keyof WikiMetadataKindMap)
                      )
                    ).then(() => {
                      window.location.reload()
                    })
                  }}
                >
                  🧹 Clear caches & Reload
                </button>
              </div>
            </div>
          ).role('raw-html'),
        }).description('WikiMetadataService'),
        'general'
      )
    })

    this.logger.info('All initialized', this._data)
  }

  async initData<T extends keyof WikiMetadataKindMap>(kind: T, noCache = false) {
    const cached = noCache ? null : await this.fetchFromCache(kind)
    if (cached) {
      this._data[kind] = cached
      this.logger.debug('Using cached', kind, cached)
      return cached
    } else {
      const data = await this.fetchFromApi(kind)
      this.saveToCache(kind, data)
      this._data[kind] = data
      this.logger.debug('Fetched from API', kind, data)
      return data
    }
  }

  private getCacheKey<T extends keyof WikiMetadataKindMap>(kind: T): string {
    return `${kind}:${new URL(this.ctx.api.config.baseURL).pathname.replace(/^\//, '')}`
  }

  async fetchFromApi<T extends keyof WikiMetadataKindMap>(
    kind: T
  ): Promise<WikiMetadataKindMap[T]> {
    return this.api
      .get({
        action: 'query',
        ...this.QUERY_DATA[kind],
      })
      .then(({ data }) => {
        if (typeof data?.query !== 'object' || data.query === null) {
          throw new Error('Invalid query data', { cause: data })
        }
        if (kind === 'siteinfo') {
          return data.query as WikiMetadataKindMap[T]
        } else {
          return (data.query?.[kind] || data.query) as WikiMetadataKindMap[T]
        }
      })
      .catch((e) => {
        this.logger.error('Failed to fetch', e)
        return Promise.reject(e)
      })
  }

  async fetchFromCache<T extends keyof WikiMetadataKindMap>(
    kind: T
  ): Promise<WikiMetadataKindMap[T] | null> {
    const key = this.getCacheKey(kind)
    const data = await this.CACHE_DB.get(key, this.CACHE_TTL[kind])
    return data as WikiMetadataKindMap[T] | null
  }
  async saveToCache<T extends keyof WikiMetadataKindMap>(kind: T, data: WikiMetadataKindMap[T]) {
    const key = this.getCacheKey(kind)
    return this.CACHE_DB.set(key, data)
  }
  async invalidateCache<T extends keyof WikiMetadataKindMap>(kind: T) {
    const key = this.getCacheKey(kind)
    return this.CACHE_DB.delete(key)
  }

  // ====== shortcuts ======
  get _raw() {
    return this._data
  }

  // siteInfo
  get siteInfo() {
    return this._data.siteinfo
  }
  get general() {
    return this.siteInfo.general
  }
  get specialPageAliases() {
    return this.siteInfo.specialpagealiases
  }
  get namespaceAliases() {
    return this.siteInfo.namespacealiases
  }
  get namespaces() {
    return this.siteInfo.namespaces
  }
  get namespaceMap() {
    const map = Object.values(this.namespaces)
      .map((ns) => ({
        id: ns.id,
        canonical: ns.canonical,
        aliases: this.namespaceAliases
          .filter((alias) => alias.id === ns.id)
          .map((alias) => alias.alias),
      }))
      .sort((a, b) => a.id - b.id)
    Reflect.defineProperty(this, 'namespaceMap', {
      get: () => map,
    })
    return map
  }
  get magicWords() {
    return this.siteInfo.magicwords
  }

  // userInfo
  get userInfo() {
    return this._data.userinfo
  }
  get userOptions() {
    return this.userInfo.options
  }
  get isUserBlocked() {
    return (
      this.userInfo.blockedbyid &&
      this.userInfo.blockexpiry &&
      new Date(this.userInfo.blockexpiry).getTime() > Date.now()
    )
  }
  get userGroups() {
    return this.userInfo.groups
  }
  get userRights() {
    return this.userInfo.rights
  }
  /**
   * Base URL, without trailing slash
   * @example "https://mediawiki.org"
   */
  get baseUrl() {
    const server = this.general.server
    if (server.startsWith('//')) {
      return `${window?.location?.protocol || 'https:'}//${server.slice(2)}`
    } else {
      return server
    }
  }
  /**
   * Home page URL of this wiki
   * @description Generally same as the Mainpage URL,
   *              but after MediaWiki 1.34,
   *              it can be set to the website root directory.
   * @example "https://mediawiki.org/wiki/Main_Page" (In most cases)
   * @example "https://mediawiki.org/" ($wgMainPageIsDomainRoot = true)
   */
  get landingPageUrl() {
    return this.general.base
  }
  get mainPageName() {
    return this.general.mainpage
  }
  /**
   * Exact Mainpage URL of this wiki
   * @example "https://mediawiki.org/wiki/Main_Page"
   */
  get mainPageUrl() {
    return this.getUrl(this.mainPageName)
  }
  /**
   * Article path, with the $1 placeholder
   * @example "/wiki/$1"
   */
  get articlePath() {
    return this.general.articlepath
  }
  /**
   * Script path, without trailing slash
   * @example "/w"
   */
  get scriptPath() {
    return this.general.scriptpath
  }
  /**
   * Article base URL, with the $1 placeholder
   * @example "https://mediawiki.org/wiki/$1"
   */
  get articleBaseUrl() {
    return `${this.baseUrl}${this.articlePath}`
  }
  /**
   * Script base URL, without trailing slash
   * @example "https://mediawiki.org/w"
   */
  get scriptBaseUrl() {
    return `${this.baseUrl}${this.scriptPath}`
  }

  // utils
  getSciprtUrl(name = 'index') {
    return `${this.scriptBaseUrl}/${name.replace(/\.php$/, '')}.php`
  }

  /** Get mainpage URL */
  getMainpageUrl(params?: Record<string, any>): string {
    return makeURL(this.siteInfo.general.base, params).toString()
  }
  /** Get page URL by title */
  getUrl(title: string, params?: Record<string, any>): string
  /** Get page URL by page ID */
  getUrl(pageId: number, params?: Record<string, any>): string
  getUrl(titleOrPageId: string | number, params?: Record<string, any>): string {
    const searchParams = makeSearchParams(params)
    let url: URL
    if (typeof titleOrPageId === 'string' && titleOrPageId !== '') {
      url = new URL(`${this.articleBaseUrl.replace('$1', titleOrPageId)}`)
    } else if (typeof titleOrPageId === 'number') {
      searchParams.set('curid', titleOrPageId.toString())
      url = new URL(this.getSciprtUrl('index'))
    } else {
      url = new URL(this.getSciprtUrl('index'))
    }
    url.search = searchParams.toString()
    return url.toString()
  }

  hasRight(right: string) {
    return this.userRights.includes(right)
  }
  hasAnyRight(...rights: string[]) {
    return rights.some((right) => this.hasRight(right))
  }
  hasEveryRights(...rights: string[]) {
    return rights.every((right) => this.hasRight(right))
  }
  inGroup(name: string) {
    return this.userGroups.includes(name)
  }
  inAnyGroup(...names: string[]) {
    return this.userGroups.some((group) => names.includes(group))
  }
  getBlockInfo() {
    if (!this.isUserBlocked) return null
    return {
      blockid: this.userInfo.blockid!,
      blockedby: this.userInfo.blockedbyid!,
      blockedbyid: this.userInfo.blockedbyid!,
      blockreason: this.userInfo.blockreason!,
      blockedtimestamp: this.userInfo.blockedtimestamp!,
      blockexpiry: this.userInfo.blockexpiry!,
    } as WikiUserBlockInfo
  }
}
