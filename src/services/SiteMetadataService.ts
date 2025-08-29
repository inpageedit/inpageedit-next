import { InPageEdit, Service } from '@/InPageEdit'
import { SiteMetadata, SiteUserBlockInfo } from '@/types/SiteMetadata'

declare module '@/InPageEdit' {
  interface InPageEdit {
    sitemeta: SiteMetadataService
  }
}

export class SiteMetadataService extends Service {
  static inject = ['api']
  private _promise?: Promise<SiteMetadata>
  private _data!: SiteMetadata

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
    this._promise ||= this.api
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
        this._promise = undefined
        return Promise.reject(e)
      })
    const meta = await this._promise!
    this._data = meta
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
