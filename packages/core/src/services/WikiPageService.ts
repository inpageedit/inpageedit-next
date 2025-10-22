import { Inject, InPageEdit, Service } from '@/InPageEdit'
import { WikiPage } from '@/models/WikiPage'
import { PageInfo } from '@/models/WikiPage/types/PageInfo'

declare module '@/InPageEdit' {
  interface InPageEdit {
    wikiPage: WikiPageService
  }
}

export class WikiPageService extends Service {
  static readonly inject: Inject = ['api']

  constructor(public ctx: InPageEdit) {
    super(ctx, 'wikiPage', true)
  }
  get WikiPage() {
    return WikiPage
  }
  async createInstance(payload: Record<string, any>) {
    const {
      data: {
        query: {
          pages: [pageInfo],
        },
      },
    } = await this.ctx.api.get({
      action: 'query',
      prop: 'info|templates|transcludedin|images|pageimages|revisions',
      inprop: 'protection|url|varianttitles',
      intestactions: 'edit|move|delete',
      tllimit: 'max',
      tilimit: 'max',
      imlimit: 'max',
      piprop: 'thumbnail|name|original',
      pithumbsize: '200',
      pilimit: 'max',
      rvprop: 'ids|timestamp|user|userid|content',
      ...payload,
    })
    return new WikiPage(pageInfo, this.ctx.api)
  }
  async newFromTitle(title: string, converttitles = false, rvsection?: number | string) {
    return this.createInstance({ titles: title, converttitles, rvsection })
  }
  async newFromPageId(pageid: number, rvsection?: number | string) {
    return this.createInstance({ pageids: pageid, rvsection })
  }
  async newFromRevision(revid: number, rvsection?: number | string) {
    return this.createInstance({ revids: revid, rvsection })
  }
  newBlankPage(init: Partial<PageInfo> = {}) {
    return new WikiPage(init, this.ctx.api)
  }
}
