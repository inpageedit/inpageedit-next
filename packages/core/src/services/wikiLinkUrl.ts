/**
 * URL helpers for recognising MediaWiki links.
 *
 * Kept free of any `InPageEdit` import so they can be unit tested
 * without booting the whole application.
 */

export interface WikiLinkUrlConfig {
  /**
   * Base URL of the wiki, without a trailing slash
   * @example "https://example.com"
   */
  baseUrl: string
  /**
   * Article base URL, with trailing slash
   * @example "https://example.com/wiki/"
   */
  articleBaseUrl: string
  /**
   * URL of the index entry point, from siteinfo `script` (`$wgScript`).
   * Not always `index.php`: translatewiki.net uses `/w/i.php`.
   * @example "https://example.com/w/index.php"
   */
  indexUrl: string
  /**
   * Origin the page is being viewed from, if any
   * @example "https://m.example.com"
   */
  currentOrigin?: string
  /**
   * Landing page URL
   * @example "https://example.com/"
   */
  landingPageUrl: string
}

/** Whether the URL is the index entry point itself, query and hash aside. */
export function isWikiIndexUrl(url: URL, config: WikiLinkUrlConfig): boolean {
  return `${url.origin}${url.pathname}` === config.indexUrl
}

/**
 * Move a link on the current host onto the wiki's own server.
 *
 * The page may be served from a host other than siteinfo `server` (a mirror,
 * a mobile domain, a reverse proxy), and relative links in it resolve against
 * that host. The API comes from the page's own EditURI, so the current host is
 * the same wiki; without this every such link would count as external.
 */
export function toWikiServerOrigin(url: URL, config: WikiLinkUrlConfig): URL {
  if (!config.currentOrigin || url.origin !== config.currentOrigin) {
    return url
  }
  let serverOrigin: string
  try {
    serverOrigin = new URL(config.baseUrl).origin
  } catch {
    return url
  }
  if (url.origin === serverOrigin) {
    return url
  }
  return new URL(`${url.pathname}${url.search}${url.hash}`, serverOrigin)
}

export function isWikiLinkUrl(url: URL, config: WikiLinkUrlConfig): boolean {
  const href = url.toString()
  return (
    href.startsWith(config.articleBaseUrl) ||
    isWikiIndexUrl(url, config) ||
    // Some servers allow index.php to be omitted
    href.startsWith(`${config.baseUrl}/?`) ||
    // It's the landing page
    href === config.landingPageUrl
  )
}

/**
 * Resolve the effective action of a wiki link.
 *
 * VisualEditor links carry the action in `veaction` instead of `action`.
 * Only `veaction=editsource` is treated as an edit: that is the 2017
 * wikitext editor, which edits the same source InPageEdit does.
 * `veaction=edit` opens VisualEditor, a different editing surface, so it
 * is deliberately left as `view` — otherwise wikis that render both
 * "edit" and "edit source" links per section would get two quick-edit
 * buttons on the same section.
 */
export function resolveWikiLinkAction(params: URLSearchParams): string {
  const action = params.get('action')
  if (action) {
    return action
  }
  const veaction = params.get('veaction')
  if (veaction === 'editsource') {
    return 'edit'
  }
  return 'view'
}

/**
 * Extract the raw title text of a wiki link.
 *
 * @param titleParam value of the `title` query parameter, if any
 */
export function extractWikiLinkTitleText(
  url: URL,
  config: WikiLinkUrlConfig,
  titleParam: string
): string {
  if (titleParam) {
    return titleParam
  }
  // Checked before the article path: when the article path sits under the
  // script path ("/w/$1" with "/w/index.php"), "index.php" would become the title
  if (isWikiIndexUrl(url, config)) {
    return ''
  }
  const articlePath = config.articleBaseUrl.replace(/^https?:\/\/[^/]+/, '')
  if (!url.pathname.startsWith(articlePath)) {
    return ''
  }
  try {
    return decodeURIComponent(url.pathname.substring(articlePath.length))
  } catch {
    return ''
  }
}
