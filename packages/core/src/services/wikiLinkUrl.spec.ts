import { describe, it, expect } from 'vitest'
import {
  extractWikiLinkTitleText,
  isWikiLinkUrl,
  isWikiScriptUrl,
  resolveWikiLinkAction,
  type WikiLinkUrlConfig,
} from './wikiLinkUrl.js'

/** 大多数 MediaWiki 站点的常见配置 */
function makeConfig(overrides: Partial<WikiLinkUrlConfig> = {}): WikiLinkUrlConfig {
  return {
    baseUrl: 'https://example.com',
    articleBaseUrl: 'https://example.com/wiki/',
    indexPhpUrl: 'https://example.com/w/index.php',
    scriptPath: '/w',
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

  it('识别非 index.php 的入口脚本（issue #61）', () => {
    // translatewiki.net 的 index.php 被配置成了 i.php
    expect(
      isWikiLinkUrl(
        new URL('https://example.com/w/i.php?title=Foo&curid=1&diff=2&oldid=3'),
        config
      )
    ).toBe(true)
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

  it('不把 article path 下以 .php 结尾的条目当成脚本', () => {
    expect(isWikiScriptUrl(new URL('https://example.com/wiki/Foo.php'), config)).toBe(false)
    expect(isWikiLinkUrl(new URL('https://example.com/wiki/Foo.php'), config)).toBe(true)
  })

  it('不把脚本路径下的子目录当成入口脚本', () => {
    expect(isWikiScriptUrl(new URL('https://example.com/w/skins/foo.php'), config)).toBe(false)
  })
})

describe('isWikiScriptUrl', () => {
  it('script path 为空（站点在根目录）时仍能识别入口脚本', () => {
    const config = makeConfig({
      articleBaseUrl: 'https://example.com/',
      indexPhpUrl: 'https://example.com/index.php',
      scriptPath: '',
    })
    expect(isWikiScriptUrl(new URL('https://example.com/index.php?title=Foo'), config)).toBe(true)
    expect(isWikiScriptUrl(new URL('https://example.com/api.php'), config)).toBe(true)
  })
})

describe('resolveWikiLinkAction', () => {
  it('优先使用 action 参数', () => {
    expect(resolveWikiLinkAction(new URLSearchParams('action=edit'))).toBe('edit')
    expect(resolveWikiLinkAction(new URLSearchParams('action=history'))).toBe('history')
  })

  it('把 veaction=editsource 视作编辑动作（issue #61）', () => {
    expect(resolveWikiLinkAction(new URLSearchParams('veaction=editsource'))).toBe('edit')
    expect(resolveWikiLinkAction(new URLSearchParams('veaction=edit'))).toBe('edit')
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

  it('脚本入口不会把文件名当成标题', () => {
    const url = new URL('https://example.com/w/i.php?curid=123')
    expect(extractWikiLinkTitleText(url, config, '')).toBe('')
    const indexPath = new URL('https://example.com/w/index.php?curid=123')
    expect(extractWikiLinkTitleText(indexPath, config, '')).toBe('')
  })

  it('能解码百分号转义的标题', () => {
    const url = new URL('https://example.com/wiki/Foo%20Bar')
    expect(extractWikiLinkTitleText(url, config, '')).toBe('Foo Bar')
  })

  it('站内但不在 article path 下的路径返回空标题', () => {
    const url = new URL('https://example.com/special/thing')
    expect(extractWikiLinkTitleText(url, config, '')).toBe('')
  })
})
