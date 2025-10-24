import { Inject, InPageEdit, Logger, Service } from '@/InPageEdit'
import { SiteMetadata, SiteUserBlockInfo } from '@/types/SiteMetadata'
import { IPEStorageManager } from './StorageService'

declare module '@/InPageEdit' {
  interface InPageEdit {
    sitemeta: SiteMetadataService
  }
}

@Inject(['api', 'storage'])
export class SiteMetadataService extends Service {
  private _data!: SiteMetadata
  private readonly CACHE_TTL = 1000 * 60 * 60 * 24 // 1 day
  private readonly VERSION = 2
  private db: IPEStorageManager<SiteMetadata>
  private logger: Logger
  private queryData = {
    meta: 'siteinfo|userinfo',
    siprop: 'general|specialpagealiases|namespacealiases|namespaces|magicwords',
    uiprop: 'groups|rights|blockinfo|options',
  }

  constructor(public ctx: InPageEdit) {
    super(ctx, 'sitemeta', false)
    this.db = ctx.storage.createDatabse<SiteMetadata>('sitemeta', this.CACHE_TTL, this.VERSION)
    this.logger = ctx.logger('SiteMetadataService')
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
      this.logger.info('Using cached metadata', cached)
      this._data = cached
      return
    }
    const meta = await this.fetchFromApi()
    this.saveToCache(meta)
    this._data = meta
  }

  computeSiteIdentity() {
    let path: string
    if (!window.mw?.config) {
      path = new URL(location.href).origin
    } else {
      const { wgServer, wgArticlePath } = window.mw.config.get()
      path = `${wgServer}${wgArticlePath}`
    }
    // magic caching
    Reflect.defineProperty(this, 'computeSiteIdentity', {
      value: () => path,
      writable: false,
      configurable: false,
      enumerable: true,
    })
    return path
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
        this.ctx.logger.error('[InPageEdit]', 'fetchMetadata error', e)
        return Promise.reject(e)
      })
  }

  async fetchFromCache() {
    const key = this.computeSiteIdentity()
    const userId = this.mwConfig.get('wgUserId', 0)
    const data = await this.db.get(key)
    if (data && data.userinfo.id === userId) {
      return data
    }
    this.logger.info('UserID changed, invalidating cache')
    this.invalidateCache()
    return null
  }
  async saveToCache(data: SiteMetadata) {
    const key = this.computeSiteIdentity()
    return this.db.set(key, data)
  }
  async invalidateCache() {
    const key = this.computeSiteIdentity()
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
      value: map,
      writable: false,
      configurable: false,
      enumerable: true,
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
   * @example "https://example.com"
   */
  get baseUrl() {
    return `${window?.location?.protocol || 'https:'}//${this.general.servername}`
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
   * @example "https://example.com/wiki/$1"
   */
  get articleBaseUrl() {
    return `${this.baseUrl}${this.articlePath}`
  }
  /**
   * Script base URL, without trailing slash
   * @example "https://example.com/w"
   */
  get scriptBaseUrl() {
    return `${this.baseUrl}${this.scriptPath}`
  }

  // utils
  getSciprtUrl(name = 'index') {
    return `${this.scriptBaseUrl}/${name.replace(/\.php$/, '')}.php`
  }

  /** Get mainpage URL */
  getMainpageUrl(params?: Record<string, string>): string {
    return makeURL(this._data.general.base, params).toString()
  }
  /** Get page URL by title */
  getUrl(title: string, params?: Record<string, string>): string
  /** Get page URL by page ID */
  getUrl(pageId: number, params?: Record<string, string>): string
  getUrl(titleOrPageId: string | number, params?: Record<string, string>): string {
    const searchParams = makeSearchParams(params)
    let url: URL
    if (typeof titleOrPageId === 'string') {
      url = new URL(`${this.articleBaseUrl.replace('$1', titleOrPageId)}`)
    } else {
      searchParams.set('curid', titleOrPageId.toString())
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
    } as SiteUserBlockInfo
  }
}
