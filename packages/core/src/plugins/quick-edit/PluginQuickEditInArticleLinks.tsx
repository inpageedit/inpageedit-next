import { Inject, InPageEdit, Schema } from '@/InPageEdit'
import { QuickEditOptions } from '.'

@Inject(['sitemeta', 'quickEdit'])
@RegisterPreferences(
  Schema.object({
    redLinkEdit: Schema.boolean()
      .description('Show quick edit entry after red links')
      .default(true),
  }).description('In-article quick edit links'),
  {
    redLinkEdit: true,
  }
)
export class PluginQuickEditInArticleLinks extends BasePlugin<{
  wikiBaseUrl: string
  wikiArticlePath: string
  wikiArticleBaseUrl: string
  wikiScriptBaseUrl: string
  linkClassName: string
}> {
  constructor(ctx: InPageEdit) {
    const mwConfig = ctx.sitemeta.mwConfig
    const wikiArticlePath = mwConfig.get('wgArticlePath', '').replace('$1', '')
    const wikiBaseUrl = `${location.protocol}//${mwConfig.get('wgServer', '').split('//')[1]}`
    super(
      ctx,
      {
        wikiBaseUrl,
        wikiArticlePath,
        wikiArticleBaseUrl: `${wikiBaseUrl}${wikiArticlePath}`,
        wikiScriptBaseUrl: `${wikiBaseUrl}${mwConfig.get('wgScriptPath', '')}`,
        linkClassName: 'ipe-quickEdit__in-article-link',
      },
      'QuickEditInArticleLinks'
    )
  }

  protected async start() {
    mw.hook('wikipage.content').add(($content) => {
      const anchorList = $content.find<HTMLAnchorElement>('a[href]').toArray()
      anchorList.forEach((anchor) => {
        const info = this.checkEditAnchor(anchor)
        if (!info || anchor.dataset.ipeQuickEditLink) {
          return
        }

        const link = (
          <a
            href={`#/IPE/quickEdit/${info.title}`}
            className={this.config.linkClassName}
            style={{
              userSelect: 'none',
              marginLeft: '0.2em',
              verticalAlign: 'middle',
            }}
            onClick={(e) => {
              e.preventDefault()
              this.ctx.quickEdit.showModal(info)
            }}
          >
            <svg
              style="width: 1em; height: 1em"
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="icon icon-tabler icons-tabler-outline icon-tabler-pencil-bolt"
            >
              <path stroke="none" d="M0 0h24v24H0z" fill="none" />
              <path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" />
              <path d="M13.5 6.5l4 4" />
              <path d="M19 16l-2 3h4l-2 3" />
            </svg>
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
