import type { PageInfo } from './types/PageInfo'
import { PageParseData } from './types/PageParseData'
import { WatchlistAction } from './types/WatchlistAction'
import { MediaWikiApi, MwApiParams, MwApiResponse, FexiosFinalContext } from 'wiki-saikou/browser'

export interface WikiPageEditPayload {
  text?: string
  prependtext?: string
  appendtext?: string
  summary?: string
  watchlist?: WatchlistAction
  section?: number | 'new' | undefined
}

export interface IWikiPage {
  pageInfo: PageInfo
  parse(params?: MwApiParams): Promise<FexiosFinalContext<MwApiResponse<{ parse: PageParseData }>>>
  preview(
    text: string,
    params?: MwApiParams
  ): Promise<FexiosFinalContext<MwApiResponse<{ parse: PageParseData }>>>
  edit(
    payload: WikiPageEditPayload,
    params?: MwApiParams
  ): Promise<FexiosFinalContext<MwApiResponse<{ success: boolean }>>>
  createOnly(
    payload: { text: string } & Pick<WikiPageEditPayload, 'summary' | 'watchlist'>,
    params?: MwApiParams
  ): Promise<FexiosFinalContext<MwApiResponse<{ success: boolean }>>>
  delete(
    reason?: string,
    params?: MwApiParams
  ): Promise<FexiosFinalContext<MwApiResponse<{ success: boolean }>>>
  moveTo(
    title: string,
    reason?: string,
    params?: Partial<
      MwApiParams & {
        movetalk: boolean
        movesubpages: boolean
      }
    >
  ): Promise<FexiosFinalContext<MwApiResponse<{ success: boolean }>>>
  userCan(action: keyof PageInfo['actions']): boolean
  userCanEdit(): boolean
  reloadSelfInfo(): Promise<this>
  // sugar getters (instance level)
  readonly pageid: PageInfo['pageid']
  readonly title: PageInfo['title']
  readonly ns: PageInfo['ns']
  readonly contentmodel: PageInfo['contentmodel']
  readonly fullurl: PageInfo['fullurl']
  readonly canonicalurl: PageInfo['canonicalurl']
  readonly editurl: PageInfo['editurl']
  readonly revisions: NonNullable<PageInfo['revisions']>
  readonly lastrevid: PageInfo['lastrevid']
  readonly templates: NonNullable<PageInfo['templates']>
  readonly images: NonNullable<PageInfo['images']>
}

export interface WikiPageConstructor {
  // Constructor
  new (pageInfo: Partial<PageInfo>, loaded?: boolean): IWikiPage
  // Static members
  newFromApi(payload: MwApiParams): Promise<IWikiPage>
  newBlankPage(init?: Partial<PageInfo>): IWikiPage
  /**
   * Create a new WikiPage instance from any kind of identifier
   * priority: revid > pageid > title
   */
  newFromAnyKind(payload: {
    title?: string
    pageid?: number
    revid?: number
  }): Promise<IWikiPage | null>
  newBatchFromApi(
    params: MwApiParams & {
      titles?: string[]
      pageids?: number[]
      revids?: number[]
    }
  ): Promise<IWikiPage[]>
}

export function createWikiPageModel(api: MediaWikiApi): WikiPageConstructor {
  class WikiPage implements IWikiPage {
    private static readonly api = api
    readonly api = api
    public pageInfo: PageInfo
    static readonly DEFAULT_QUERY_PARAMS: MwApiParams = {
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
      rvprop: 'ids|timestamp|flags|comment|user|content',
      rvslots: 'main',
    }
    static readonly DEFAULT_PAGE_INFO: PageInfo = {
      pageid: 0,
      ns: 0,
      title: '',
      contentmodel: 'wikitext',
      pagelanguage: '',
      pagelanguagehtmlcode: '',
      pagelanguagedir: 'ltr',
      touched: new Date().toISOString(),
      lastrevid: 0,
      length: 0,
      protection: [],
      restrictiontypes: [],
      fullurl: '',
      canonicalurl: '',
      editurl: '',
      varianttitles: {},
      actions: {
        edit: true,
        move: false,
        delete: false,
      },
      revisions: [],
      templates: [],
      images: [],
    }

    constructor(
      pageInfo: Partial<PageInfo>,
      public _loaded = true
    ) {
      // Handle modern MW content model slots
      pageInfo.revisions?.forEach((rev) => {
        // @ts-ignore
        if (typeof rev?.slots?.main === 'object') {
          Object.assign(rev, (rev as any).slots.main)
        }
      })
      this.pageInfo = {
        ...WikiPage.DEFAULT_PAGE_INFO,
        ...pageInfo,
      }
    }

    // Utils
    static async newFromApi(payload: MwApiParams) {
      const { data } = await this.api.get<{
        query: {
          pages: PageInfo[]
        }
      }>({
        ...WikiPage.DEFAULT_QUERY_PARAMS,
        ...payload,
      })
      const info = data?.query?.pages?.[0]
      if (!info || !info.title) {
        throw new Error('Invalid page info', { cause: data })
      }
      return new WikiPage(info, true)
    }
    static newBlankPage(init: Partial<PageInfo> = {}) {
      return new WikiPage(init, false)
    }
    static async newFromAnyKind(payload: { title?: string; pageId?: number; revisionId?: number }) {
      const { title, pageId, revisionId } = payload || {}
      if (revisionId) {
        return this.newFromApi({ revids: parseInt(revisionId.toString(), 10) })
      } else if (pageId) {
        return this.newFromApi({ pageids: parseInt(pageId.toString(), 10) })
      } else if (title) {
        return this.newFromApi({ titles: title.toString() })
      }
      return null
    }
    static async newBatchFromApi(
      params: MwApiParams & {
        titles?: string[]
        pageids?: number[]
        revids?: number[]
      }
    ) {
      const { titles, pageids, revids, ...rest } = params || {}
      const { data } = await this.api.post<{
        query: {
          pages: PageInfo[]
        }
      }>({
        ...WikiPage.DEFAULT_QUERY_PARAMS,
        titles: titles?.join('|') ?? undefined,
        pageids: pageids?.join('|') ?? undefined,
        revids: revids?.join('|') ?? undefined,
        ...rest,
      })
      return data?.query?.pages?.map((page) => new WikiPage(page, true)) || []
    }

    // Page actions
    async parse(params?: MwApiParams) {
      return this.api.post({
        action: 'parse',
        page: this.pageInfo.title,
        prop: 'text|langlinks|categories|links|templates|images|externallinks|sections|revid|displaytitle|iwlinks|properties|parsewarnings',
        ...params,
      })
    }
    async preview(text: string, params?: MwApiParams) {
      return this.parse({
        action: 'parse',
        page: undefined,
        title: this.title,
        text,
        pst: 1,
        preview: 1,
        disableeditsection: 1,
        disablelimitreport: 1,
        ...params,
      })
    }
    async edit(payload: WikiPageEditPayload, params?: MwApiParams) {
      const {
        text,
        prependtext,
        appendtext,
        summary = '',
        watchlist = WatchlistAction.preferences,
        section,
      } = payload
      return this.api.postWithEditToken({
        action: 'edit',
        title: this.title,
        starttimestamp: this.pageInfo.touched,
        basetimestamp: this.revisions[0]?.timestamp,
        text,
        prependtext,
        appendtext,
        summary,
        watchlist,
        section,
        ...params,
      })
    }
    async createOnly(
      payload: { text: string; summary?: string; watchlist?: WatchlistAction },
      params?: MwApiParams
    ) {
      return this.edit(payload, { createonly: 1, ...params })
    }
    async delete(reason?: string, params?: MwApiParams) {
      return this.api.postWithEditToken({
        action: 'delete',
        pageid: this.pageInfo.pageid,
        reason,
        ...params,
      })
    }
    async moveTo(
      title: string,
      reason?: string,
      params?: Partial<
        MwApiParams & {
          movetalk: boolean
          movesubpages: boolean
        }
      >
    ) {
      return this.api.postWithEditToken({
        action: 'move',
        from: this.pageInfo.title,
        to: title,
        reason,
        movetalk: 1,
        movesubpages: 1,
        ...params,
      })
    }

    // === utilities ===

    userCan(action: keyof PageInfo['actions']) {
      const val = this.pageInfo?.actions?.[action]
      return !!val
    }
    userCanEdit() {
      return this.userCan('edit')
    }
    async reloadSelfInfo() {
      const page = await WikiPage.newFromApi({
        pageids: this.pageInfo.pageid,
        titles: this.pageInfo.title,
      })
      const revisions = (this.pageInfo.revisions || [])
        .concat(page.revisions || [])
        .sort((a, b) => a.revid - b.revid)
        .reduce(
          (acc, cur) => {
            if (!acc.find((rev) => rev.revid === cur.revid)) acc.push(cur)
            return acc
          },
          [] as Required<PageInfo>['revisions']
        )
      this.pageInfo = page.pageInfo
      this.pageInfo.revisions = revisions
      this._loaded = true
      return this
    }

    // === sugar getters ===
    get pageid() {
      return this.pageInfo.pageid
    }
    get title() {
      return this.pageInfo.title
    }
    get ns() {
      return this.pageInfo.ns
    }
    get contentmodel() {
      return this.pageInfo.contentmodel
    }
    get fullurl() {
      return this.pageInfo.fullurl
    }
    get canonicalurl() {
      return this.pageInfo.canonicalurl
    }
    get editurl() {
      return this.pageInfo.editurl
    }
    get revisions() {
      return this.pageInfo.revisions || []
    }
    get lastrevid() {
      return this.pageInfo.lastrevid
    }
    get templates() {
      return this.pageInfo.templates || []
    }
    get images() {
      return this.pageInfo.images || []
    }
  }

  return WikiPage as WikiPageConstructor
}
