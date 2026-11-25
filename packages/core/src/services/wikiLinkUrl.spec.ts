import { describe, it, expect } from 'vitest'
import {
  extractWikiLinkTitleText,
  isWikiLinkUrl,
  resolveWikiLinkAction,
  type WikiLinkUrlConfig,
  toWikiServerOrigin,
} from './wikiLinkUrl.js'

/** 大多数 MediaWiki 站点的常见配置 */
function makeConfig(overrides: Partial<WikiLinkUrlConfig> = {}): WikiLinkUrlConfig {
  return {
    baseUrl: 'https://example.com',
    articleBaseUrl: 'https://example.com/wiki/',
    indexUrl: 'https://example.com/w/index.php',
    landingPageUrl: 'https://example.com/',
    ...overrides,
  }
}

describe('isWikiLinkUrl', () => {
  const config = makeConfig()

  it('识别标准的 /wiki/ 链接', () => {
    expect(isWikiLinkUrl(new URL('https://example.com/wiki/Foo_Bar'), config)).toBe(true)
  })

  it('识别 index.php 链接', () => {
    expect(isWikiLinkUrl(new URL('https://example.com/w/index.php?title=Foo'), config)).toBe(true)
  })

  it('按 siteinfo 的 script 识别改过名的 index 入口（issue #61）', () => {
    // translatewiki.net 的 $wgScript 是 /w/i.php
    const twn = makeConfig({ indexUrl: 'https://example.com/w/i.php' })
    expect(
      isWikiLinkUrl(new URL('https://example.com/w/i.php?title=Foo&curid=1&diff=2&oldid=3'), twn)
    ).toBe(true)
  })

  it('不把 api.php 等其他入口当成 wiki 链接', () => {
    expect(isWikiLinkUrl(new URL('https://example.com/w/api.php?action=query'), config)).toBe(false)
    expect(isWikiLinkUrl(new URL('https://example.com/w/load.php?modules=site'), config)).toBe(
      false
    )
  })

  it('识别省略 index.php 的链接', () => {
    expect(isWikiLinkUrl(new URL('https://example.com/?title=Foo'), config)).toBe(true)
  })

  it('识别首页', () => {
    expect(isWikiLinkUrl(new URL('https://example.com/'), config)).toBe(true)
  })

  it('不把站外链接当成 wiki 链接', () => {
    expect(isWikiLinkUrl(new URL('https://other.example.org/wiki/Foo'), config)).toBe(false)
    expect(isWikiLinkUrl(new URL('https://other.example.org/w/index.php?title=Foo'), config)).toBe(
      false
    )
    expect(isWikiLinkUrl(new URL('https://other.example.org/w/i.php?title=Foo'), config)).toBe(
      false
    )
  })

  it('把 article path 下以 .php 结尾的条目当成条目', () => {
    expect(isWikiLinkUrl(new URL('https://example.com/wiki/Foo.php'), config)).toBe(true)
    expect(extractWikiLinkTitleText(new URL('https://example.com/wiki/Foo.php'), config, '')).toBe(
      'Foo.php'
    )
  })
})

describe('resolveWikiLinkAction', () => {
  it('优先使用 action 参数', () => {
    expect(resolveWikiLinkAction(new URLSearchParams('action=edit'))).toBe('edit')
    expect(resolveWikiLinkAction(new URLSearchParams('action=history'))).toBe('history')
  })

  it('把 veaction=editsource 视作编辑动作（issue #61）', () => {
    expect(resolveWikiLinkAction(new URLSearchParams('veaction=editsource'))).toBe('edit')
    expect(
      resolveWikiLinkAction(new URLSearchParams('title=Foo&section=2&veaction=editsource'))
    ).toBe('edit')
  })

  it('不把 veaction=edit 当成编辑动作', () => {
    // VE 的「编辑」按钮与「编辑源代码」按钮会在同一段落并排出现，
    // 若把 veaction=edit 也算成编辑，同一个段落会挂两个快速编辑按钮
    expect(resolveWikiLinkAction(new URLSearchParams('veaction=edit'))).toBe('view')
    expect(resolveWikiLinkAction(new URLSearchParams('title=Foo&section=2&veaction=edit'))).toBe(
      'view'
    )
  })

  it('没有动作参数时默认为 view', () => {
    expect(resolveWikiLinkAction(new URLSearchParams(''))).toBe('view')
    expect(resolveWikiLinkAction(new URLSearchParams('section=2'))).toBe('view')
  })

  it('不把无法识别的 veaction 当成编辑', () => {
    expect(resolveWikiLinkAction(new URLSearchParams('veaction=visualdiff'))).toBe('view')
  })
})

describe('extractWikiLinkTitleText', () => {
  const config = makeConfig()

  it('优先使用 title 参数', () => {
    const url = new URL('https://example.com/w/i.php?title=Foo_Bar')
    expect(extractWikiLinkTitleText(url, config, 'Foo_Bar')).toBe('Foo_Bar')
  })

  it('从 article path 中取标题', () => {
    const url = new URL('https://example.com/wiki/Foo_Bar')
    expect(extractWikiLinkTitleText(url, config, '')).toBe('Foo_Bar')
  })

  it('index 入口不会把文件名当成标题', () => {
    const twn = makeConfig({ indexUrl: 'https://example.com/w/i.php' })
    expect(
      extractWikiLinkTitleText(new URL('https://example.com/w/i.php?curid=123'), twn, '')
    ).toBe('')
    const indexPath = new URL('https://example.com/w/index.php?curid=123')
    expect(extractWikiLinkTitleText(indexPath, config, '')).toBe('')
  })

  it('能解码百分号转义的标题', () => {
    const url = new URL('https://example.com/wiki/Foo%20Bar')
    expect(extractWikiLinkTitleText(url, config, '')).toBe('Foo Bar')
  })

  it('article path 位于 script path 下时，index.php 不会被当成标题', () => {
    const nested = makeConfig({ articleBaseUrl: 'https://example.com/w/' })
    const url = new URL('https://example.com/w/index.php?curid=1&diff=2&oldid=1')
    expect(extractWikiLinkTitleText(url, nested, '')).toBe('')
  })

  it('站内但不在 article path 下的路径返回空标题', () => {
    const url = new URL('https://example.com/special/thing')
    expect(extractWikiLinkTitleText(url, config, '')).toBe('')
  })
})

describe('toWikiServerOrigin', () => {
  const config = makeConfig({ currentOrigin: 'https://m.example.com' })

  it('把当前访问域名上的链接换到 server 的域名', () => {
    const url = new URL('https://m.example.com/w/index.php?title=Foo&diff=2&oldid=1#bar')
    const moved = toWikiServerOrigin(url, config)
    expect(moved.href).toBe('https://example.com/w/index.php?title=Foo&diff=2&oldid=1#bar')
    expect(isWikiLinkUrl(moved, config)).toBe(true)
  })

  it('不动真正的站外链接', () => {
    const url = new URL('https://other.example.org/wiki/Foo')
    expect(toWikiServerOrigin(url, config)).toBe(url)
    expect(isWikiLinkUrl(toWikiServerOrigin(url, config), config)).toBe(false)
  })

  it('当前域名与 server 相同或未知时原样返回', () => {
    const url = new URL('https://example.com/wiki/Foo')
    expect(toWikiServerOrigin(url, makeConfig({ currentOrigin: 'https://example.com' }))).toBe(url)
    expect(toWikiServerOrigin(url, makeConfig())).toBe(url)
  })
})
