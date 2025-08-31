import { Inject, InPageEdit, Service } from '@/InPageEdit'
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
  private siteIdentity?: string
  private readonly CACHE_TTL = 1000 * 60 * 60 * 24 // 1 day
  private db: IPEStorageManager<SiteMetadata>

  constructor(public ctx: InPageEdit) {
    super(ctx, 'sitemeta', false)
    this.db = ctx.storage.createDatabse<SiteMetadata>('sitemeta', this.CACHE_TTL)
  }

  get api() {
    return this.ctx.api
  }

  get mwConfig(): ReturnType<typeof mw.config.get> {
    // @ts-expect-error
    return mw.config.values
  }

  protected async start(): Promise<void> {
    const cached = await this.fetchFromCache()
    if (cached) {
      this.ctx.logger('SiteMetadataService').info('Using cached metadata')
      this._data = cached
      return
    }
    const meta = await this.fetchFromApi()
    this.saveToCache(meta)
    this._data = meta
  }

  async computeSiteIdentity() {
    if (this.siteIdentity) return this.siteIdentity
    let path: string
    if (!window.mw?.config) {
      path = new URL(location.href).origin
    } else {
      const { wgServer, wgArticlePath } = window.mw.config.get()
      path = `${wgServer}${wgArticlePath}`
    }
    this.siteIdentity = path
    return this.siteIdentity
  }

  async fetchFromApi() {
    return this.api
      .get({
        action: 'query',
        meta: 'siteinfo|userinfo',
        siprop: 'general|specialpagealiases|namespacealiases|magicwords',
        uiprop: 'groups|rights|blockinfo|options',
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
    const key = await this.computeSiteIdentity()
    return this.db.get(key)
  }
  async saveToCache(data: SiteMetadata) {
    const key = await this.computeSiteIdentity()
    return this.db.set(key, data)
  }

  // shortcuts

  get _raw() {
    return this._data
  }
  get siteInfo() {
    return this._data.general
  }
  get specialPageAliases() {
    return this._data.specialpagealiases
  }
  get namespaceAliases() {
    return this._data.namespacealiases
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

  // utils

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
