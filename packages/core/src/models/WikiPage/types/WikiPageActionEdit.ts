import { WatchlistAction } from './WatchlistAction.js'

/**
 * Request body of MediaWiki edit action
 * @see https://www.mediawiki.org/wiki/API:Edit
 */
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

/**
 * Result of MediaWiki edit action
 * @see https://www.mediawiki.org/wiki/API:Edit
 */
export interface WikiPageActionEditResult {
  result: 'Success' | 'Failure'
  pageid: number
  title: string
  contentmodel: string
  nochange?: boolean
  watched?: boolean
}
