import { Inject, InPageEdit } from '@/InPageEdit'

declare module '@/InPageEdit' {
  interface InPageEdit {
    inArticleLinks: PluginInArticleLinks
  }
}

export interface InArticleWikiLinkStat {
  $el: HTMLAnchorElement
  url: URL
  query: URLSearchParams
  hash: string
  kind: 'normal' | 'mw:File'
  /** MediaWiki page title */
  title: string
  external: boolean
  action: 'view' | 'edit' | 'create' | 'diff' | string
}

@Inject(['sitemeta'])
export class PluginInArticleLinks extends BasePlugin<{
  wikiBaseUrl: string
  wikiArticlePath: string
  wikiArticleBaseUrl: string
  wikiScriptBaseUrl: string
  linkClassName: string
}> {
  constructor(ctx: InPageEdit) {
    const mwConfig = ctx.sitemeta.mwConfig
    const wikiArticlePath = mwConfig.wgArticlePath.replace('$1', '')
    const wikiBaseUrl = `${location.protocol}//${mwConfig.wgServer.split('//')[1]}`
    super(
      ctx,
      {
        wikiBaseUrl,
        wikiArticlePath,
        wikiArticleBaseUrl: `${wikiBaseUrl}${wikiArticlePath}`,
        wikiScriptBaseUrl: `${wikiBaseUrl}${mwConfig.wgScriptPath}`,
        linkClassName: 'ipe__in-article-link',
      },
      'InArticleLinks'
    )
  }

  protected async start() {}

  protected async stop() {}

  parseInArticleLinkInfo(anchor: HTMLAnchorElement): InArticleWikiLinkStat | null {
    if (!(anchor instanceof HTMLAnchorElement)) {
      return null
    }

    const href = anchor.href || ''
    if (
      !href.startsWith(this.config.wikiArticleBaseUrl) &&
      !href.startsWith(this.config.wikiScriptBaseUrl)
    ) {
      return null
    }
    const hrefURL = new URL(href)
    const params = hrefURL.searchParams
    const hash = hrefURL.hash.replace('#', '')
    const action = params.get('action') || 'view'
    const title =
      params.get('title') ||
      decodeURI(hrefURL.pathname.substring(this.config.wikiArticlePath.length)) ||
      ''

    // 不合法的 title
    if (!title || title.endsWith('.php')) {
      return null
    }

    return {
      $el: anchor,
      url: hrefURL,
      query: params,
      hash,
      kind: anchor.closest('[title^="mw:File"]') ? 'mw:File' : 'normal',
      external:
        anchor.classList.contains('external') || !!anchor.getAttribute('href')?.startsWith('http'),
      action,
      title,
    }
  }
}
