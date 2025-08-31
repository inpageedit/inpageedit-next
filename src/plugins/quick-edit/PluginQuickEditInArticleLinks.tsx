import { Inject, InPageEdit } from '@/InPageEdit'
import { QuickEditOptions } from '.'

@Inject(['sitemeta', 'quickEdit'])
export class PluginQuickEditInArticleLinks extends BasePlugin<{
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
        linkClassName: 'ipe-quickEdit__in-article-link',
      },
      'QuickEditInArticleLinks'
    )
  }

  protected async start() {
    mw.hook('wikipage.content').add(() => {
      const anchorList = document.querySelectorAll<HTMLAnchorElement>('#mw-content-text a[href]')
      anchorList.forEach((anchor) => {
        const info = this.checkEditAnchor(anchor)
        if (!info || anchor.dataset.ipeQuickEditLink) {
          return
        }

        const link = (
          <a
            href={`#/IPE/quickEdit/${info.title}`}
            className={this.config.linkClassName}
            onClick={(e) => {
              e.preventDefault()
              this.ctx.quickEdit(info)
            }}
          >
            Quick Edit
          </a>
        )

        anchor.insertAdjacentElement('afterend', link)
        anchor.dataset.ipeQuickEditLink = 'true'
      })
    })
  }

  stop() {
    document.querySelectorAll(`.${this.config.linkClassName}`).forEach((el) => el.remove())
  }

  checkEditAnchor(
    anchor: HTMLAnchorElement
  ): Pick<QuickEditOptions, 'title' | 'section' | 'revision' | 'createOnly'> | null {
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
    const action = params.get('action') || 'view'
    const title =
      params.get('title') ||
      decodeURI(hrefURL.pathname.substring(this.config.wikiArticlePath.length)) ||
      ''
    const section = params.get('section')?.replace(/^T-/, '') || undefined
    const revision = params.get('oldid')

    if (
      // 不合法的 title
      !title ||
      title.endsWith('.php') ||
      // 不是 edit 相关操作
      !['edit', 'editsource', 'editredlink', 'submit'].includes(action) ||
      // 暂时未兼容 undo
      params.get('undo') ||
      // 暂时未兼容 preload
      params.get('preload')
    ) {
      return null
    }

    let sectionNum: 'new' | number | undefined = undefined
    if (section === 'new') {
      sectionNum = 'new'
    } else if (section && /^\d+$/.test(section)) {
      sectionNum = parseInt(section, 10)
    }

    return {
      title,
      section: sectionNum,
      revision: parseInt('' + revision, 10) || 0,
      createOnly: !!params.get('redlink'),
    }
  }
}
