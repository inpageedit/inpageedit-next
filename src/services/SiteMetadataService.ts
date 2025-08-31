import { InPageEdit, Service } from '@/InPageEdit'
import { SiteMetadata, SiteUserBlockInfo } from '@/types/SiteMetadata'

declare module '@/InPageEdit' {
  interface InPageEdit {
    sitemeta: SiteMetadataService
  }
}

export class SiteMetadataService extends Service {
  static inject = ['api']
  private _data!: SiteMetadata
  private siteIdentity?: string
  private readonly CACHE_TTL = 1000 * 60 * 60 * 24 // 1 day

  constructor(public ctx: InPageEdit) {
    super(ctx, 'sitemeta', false)
  }

  get api() {
    return this.ctx.get('api')!
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
    const hash = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(path)).then((hash) => {
      const hashArray = Array.from(new Uint8Array(hash))
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
      return hashHex
    })
    this.siteIdentity = `IPE:sitemeta/${hash}`
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
    const raw = localStorage.getItem(key)
    if (!raw) return null
    try {
      const data = JSON.parse(raw)
      if (!data.time || !data.value) {
        throw new Error('Invalid cache data')
      }
      const now = Date.now()
      if (now - data.time > this.CACHE_TTL) {
        localStorage.removeItem(key)
        return null
      }
      return data.value
    } catch (e) {
      this.ctx.logger.error('[InPageEdit]', 'fetchMetadata cache error', e)
      return null
    }
  }
  async saveToCache(data: SiteMetadata) {
    const key = await this.computeSiteIdentity()
    const now = Date.now()
    const cacheData = {
      time: now,
      value: data,
    }
    localStorage.setItem(key, JSON.stringify(cacheData))
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
