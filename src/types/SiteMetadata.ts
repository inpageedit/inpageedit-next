export interface SiteMetadata {
  general: SiteInfo
  specialpagealiases: SiteSpecialPageAlias[]
  namespacealiases: SiteNameSpaceAlias[]
  magicwords: SiteMagicWord[]
  userinfo: SiteUserInfo & {
    options: SiteUserOptions
  }
  namespaces: Record<string, SiteNamespace>
}

export interface SiteInfo {
  mainpage: string
  base: string
  sitename: string
  mainpageisdomainroot: boolean
  logo: string
  generator: string
  phpversion: string
  phpsapi: string
  dbtype: string
  dbversion: string
  imagewhitelistenabled: boolean
  langconversion: boolean
  titleconversion: boolean
  linkprefixcharset: string
  linkprefix: string
  linktrail: string
  legaltitlechars: string
  invalidusernamechars: string
  allunicodefixes: boolean
  fixarabicunicode: boolean
  fixmalayalamunicode: boolean
  'git-hash'?: string
  'git-branch'?: string
  case: 'first-letter' | string // ?
  lang: string
  fallback?: {
    code: string
  }[]
  variants: {
    code: string
    name: string
  }[]
  rtl: boolean
  fallback8bitEncoding: string
  readonly: boolean
  writeapi: boolean
  maxarticlesize: number
  timezone: string
  timeoffset: number
  articlepath: string
  scriptpath: string
  script: string
  variantarticlepath: string | false
  server: string
  servername: string
  wikiid: string
  time: string
  misermode: boolean
  uploadsenabled: boolean
  maxuploadsize: number
  minuploadchunksize: number
  galleryoptions: {
    imagesPerRow: number
    imageWidth: number
    imageHeight: number
    captionLength: boolean
    showBytes: boolean
    showDimensions: boolean
    mode: 'traditional' | string // ?
  }
  thumblimits: Record<`${number}`, number>
  imagelimits: Record<`${number}`, { width: number; height: number }>
  favicon: string
  centralidlookupprovider: string
  allcentralidlookupproviders: string[]
  interwikimagic: boolean
  magiclinks: Record<string, boolean>
  categorycollation: 'uppercase' | string // ?
  citeresponsivereferences: boolean
}

export interface SiteSpecialPageAlias {
  realname: string
  aliases: string[]
}

export interface SiteNameSpaceAlias {
  id: number
  alias: string
}

export interface SiteNamespace {
  canonical: string
  case: 'first-letter' | string // ?
  content: boolean
  id: number
  name: string
  namespaceprotection?: string
  nonincludable: boolean
  subpages: boolean
}

export interface SiteMagicWord {
  name: string
  aliases: string[]
  'case-sensitive': boolean
}

export type SiteUserInfo = {
  id: number
  name: string
  groups: string[]
  rights: string[]
} & Partial<SiteUserBlockInfo>

export interface SiteUserBlockInfo {
  blockid: number
  blockedby: string
  blockedbyid: string
  blockreason: string
  blockedtimestamp: string
  blockexpiry: string
}

type IntBool = 0 | 1
export interface SiteUserOptions {
  minordefault: IntBool
  watchcreations: IntBool
  watchdefault: IntBool
  watchdeletion: IntBool
  watchuploads: IntBool
  watchmoves: IntBool
  language: string
  [key: string]: unknown
}
