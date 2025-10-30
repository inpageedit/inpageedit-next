import { Inject, InPageEdit, Service } from '@/InPageEdit'
import { createWikiPageModel, IWikiPage, WikiPageConstructor } from '@/models/WikiPage'
import { PageInfo } from '@/models/WikiPage/types/PageInfo'
import { IWikiTitle } from '@/models/WikiTitle/index.js'

declare module '@/InPageEdit' {
  interface InPageEdit {
    wikiPage: WikiPageService
  }
}

export class WikiPageService extends Service {
  static readonly inject: Inject = ['api']
  WikiPage: WikiPageConstructor

  constructor(public ctx: InPageEdit) {
    super(ctx, 'wikiPage', true)
    this.WikiPage = createWikiPageModel(this.ctx.api)
  }

  async createInstance(payload: Record<string, any>, noCache = false) {
    const page = await this.WikiPage.newFromApi(payload)
    return page
  }
  async newFromTitle(
    title: string | IWikiTitle,
    converttitles = false,
    rvsection?: number | string,
    noCache = false
  ) {
    return this.createInstance({ titles: title.toString(), converttitles, rvsection }, noCache)
  }
  async newFromPageId(pageid: number, rvsection?: number | string, noCache = false) {
    return this.createInstance({ pageids: pageid, rvsection }, noCache)
  }
  async newFromRevision(revid: number, rvsection?: number | string, noCache = false) {
    return await this.createInstance({ revids: revid, rvsection }, noCache)
  }
  newBlankPage(init: Partial<PageInfo> = {}) {
    return this.WikiPage.newBlankPage(init)
  }
}

// TODO: Currently not used
class WikiPageCache {
  private _cachedPages = new Map<string, IWikiPage>()
  getCacheByPayload(payload: Record<string, any>) {
    const title = payload.titles || ''
    const pageId = payload.pageids ? String(payload.pageids) : ''
    const revId = payload.revids ? String(payload.revids) : ''
    const section = payload.rvsection ? String(payload.rvsection) : 'full'
    let cacheKey = ''

    if (revId) {
      cacheKey = `rev:${revId}#${section}`
    } else if (pageId) {
      cacheKey = `pageid:${pageId}#section:${section}`
    } else if (title) {
      cacheKey = `title:${title}#section:${section}`
    }
    return this._cachedPages.get(cacheKey) || null
  }
  setCacheByPage(page: IWikiPage, section?: number | string) {
    const title = page.title || ''
    const pageId = page.pageid ? String(page.pageid) : ''
    const revId = page.revisions?.[0]?.revid ? String(page.revisions[0].revid) : ''
    const sectionStr = section !== void 0 ? String(section) : 'full'
    if (!pageId) {
      return page
    }
    const keys = [
      `rev:${revId}#section:${sectionStr}`,
      `pageid:${pageId}#section:${sectionStr}`,
      `title:${title}#section:${sectionStr}`,
    ]
    keys.forEach((cacheKey) => {
      this._cachedPages.set(cacheKey, page)
    })
    return page
  }
  removeCacheByPage(page: IWikiPage) {
    this._cachedPages.entries().forEach(([key, cachedPage]) => {
      if (cachedPage.pageid === page.pageid) {
        this._cachedPages.delete(key)
      }
    })
    return this
  }
}
