import { Inject, InPageEdit, Logger, Schema, Service } from '@/InPageEdit'
import { WikiMetadata, WikiUserBlockInfo } from '@/types/WikiMetadata'
import { AbstractIPEStorageManager } from './storage'

declare module '@/InPageEdit' {
  interface InPageEdit {
    wiki: WikiMetadataService
    getUrl: WikiMetadataService['getUrl']
    getSciprtUrl: WikiMetadataService['getSciprtUrl']
    getMainpageUrl: WikiMetadataService['getMainpageUrl']
  }
}

@Inject(['api', 'storage'])
export class WikiMetadataService extends Service {
  private _data!: WikiMetadata
  private readonly CACHE_TTL = 1000 * 60 * 60 * 24 // 1 day
  private readonly VERSION = 2
  private db: AbstractIPEStorageManager<WikiMetadata>
  private logger: Logger
  private queryData = {
    meta: 'siteinfo|userinfo',
    siprop: 'general|specialpagealiases|namespacealiases|namespaces|magicwords',
    uiprop: 'groups|rights|blockinfo|options',
  }

  constructor(public ctx: InPageEdit) {
    super(ctx, 'wiki', false)
    this.db = ctx.storage.createDatabse<WikiMetadata>('wiki-metadata', this.CACHE_TTL, this.VERSION)
    this.logger = ctx.logger('WIKI_METADATA')
  }

  get api() {
    return this.ctx.api
  }

  mwConfig = {
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
    const cached = await this.fetchFromCache()
    if (cached) {
      this._data = cached
      this.logger.debug('Using cached')
    } else {
      const meta = await this.fetchFromApi()
      this.saveToCache(meta)
      this._data = meta
      this.logger.debug('Fetched from API')
    }
    this.logger.info('loaded', this._data)

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
              <p>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    this.invalidateCache().then(() => {
                      window.location.reload()
                    })
                  }}
                >
                  Clear caches and reload page
                </button>
              </p>
            </div>
          ).role('raw-html'),
        }).description('WikiMetadataService'),
        'general'
      )
    })
  }

  get metadataCacheId() {
    return this.ctx.api.config.baseURL
  }

  async fetchFromApi() {
    return this.api
      .get({
        action: 'query',
        ...this.queryData,
      })
      .then(({ data }) => {
        if (typeof data?.query?.general === 'undefined') {
          throw new Error('Invalid siteinfo')
        }
        return data.query
      })
      .catch((e) => {
        this.logger.error('Failed to fetch metadata', e)
        return Promise.reject(e)
      })
  }

  async fetchFromCache() {
    const key = this.metadataCacheId
    const userId = this.mwConfig.get('wgUserId', 0)
    const data = await this.db.get(key)
    if (data && typeof data === 'object' && !!data.general && data.userinfo.id === userId) {
      return data
    } else {
      this.logger.info(data ? 'Cache mis-match' : 'Missing cache')
      this.invalidateCache()
      return null
    }
  }
  async saveToCache(data: WikiMetadata) {
    const key = this.metadataCacheId
    return this.db.set(key, data)
  }
  async invalidateCache() {
    const key = this.metadataCacheId
    return this.db.delete(key)
  }

  // shortcuts

  get _raw() {
    return this._data
  }
  get general() {
    return this._data.general
  }
  get specialPageAliases() {
    return this._data.specialpagealiases
  }
  get namespaceAliases() {
    return this._data.namespacealiases
  }
  get namespaces() {
    return this._data.namespaces
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
    return this._data.magicwords
  }
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
    return makeURL(this._data.general.base, params).toString()
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
