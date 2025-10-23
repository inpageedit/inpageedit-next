import type { PageInfo } from './types/PageInfo'
import { PageParseData } from './types/PageParseData'
import { WatchlistAction } from './types/WatchlistAction'
import { MediaWikiApi, MwApiParams } from 'wiki-saikou/browser'

export class WikiPage {
  readonly api: MediaWikiApi
  public pageInfo: PageInfo
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

  constructor(pageInfo: Partial<PageInfo>, api?: MediaWikiApi) {
    this.pageInfo = {
      ...WikiPage.DEFAULT_PAGE_INFO,
      ...pageInfo,
    }
    this.api = api || new MediaWikiApi()
  }

  // Utils
  async fetchPageInfo(payload: MwApiParams) {
    const {
      data: {
        query: {
          pages: [pageInfo],
        },
      },
    } = await this.api.get<{
      query: {
        pages: PageInfo[]
      }
    }>({
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
      ...payload,
    })
    pageInfo.revisions?.forEach((rev) => {
      // @ts-ignore
      if (typeof rev.slots === 'object') {
        const mainSlot = (rev as any).slots.main
        if (mainSlot) {
          rev.content = mainSlot.content
          rev.contentmodel = mainSlot['contentmodel']
          rev.contentformat = mainSlot['contentformat']
        }
      }
    })
    return pageInfo
  }

  // Page actions
  async parse(params?: MwApiParams) {
    return this.api.post<{
      parse: PageParseData
    }>({
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
  async edit(
    payload: {
      text?: string
      prependtext?: string
      appendtext?: string
      summary?: string
      watchlist?: WatchlistAction
      section?: number | 'new' | undefined
    },
    params?: MwApiParams
  ) {
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
    return val
  }
  userCanEdit() {
    return this.userCan('edit')
  }
  async reloadSelfInfo() {
    const pageInfo = await this.fetchPageInfo({
      pageids: this.pageInfo.pageid,
      titles: this.pageInfo.title,
    })
    const revisions = (this.pageInfo.revisions || [])
      .concat(pageInfo.revisions || [])
      .sort((a, b) => a.revid - b.revid)
      .reduce(
        (acc, cur) => {
          if (!acc.find((rev) => rev.revid === cur.revid)) acc.push(cur)
          return acc
        },
        [] as Required<PageInfo>['revisions']
      )
    this.pageInfo = pageInfo
    this.pageInfo.revisions = revisions
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
  get templates() {
    return this.pageInfo.templates || []
  }
  get images() {
    return this.pageInfo.images || []
  }
}
