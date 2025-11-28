import { WatchlistAction } from './WatchlistAction.js'

export interface WikiPageActionEditRequest {
  text?: string
  prependtext?: string
  appendtext?: string
  summary?: string
  watchlist?: WatchlistAction
  section?: number | 'new' | undefined
  createonly?: boolean
  recreate?: boolean
  starttimestamp?: string
  baserevid?: number
}

export interface WikiPageActionEditResult {
  result: 'Success' | 'Failure' | 'Warning' | 'Error'
  pageid: number
  title: string
  contentmodel: string
  nochange: boolean
  watched: boolean
}
