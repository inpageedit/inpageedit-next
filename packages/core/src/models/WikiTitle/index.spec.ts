import { describe, it, expect, beforeEach } from 'vitest'
import { createWikiTitleModel } from './index.js'
import { SiteMetadata } from '@/types/SiteMetadata.js'
import { MOCK_SITE_METADATA } from '@/__test__/utils/constants.js'

// 创建测试用的 SiteMetadata
const getSiteMetadata = (): SiteMetadata => MOCK_SITE_METADATA

describe('WikiTitle', () => {
  let WikiTitle: ReturnType<typeof createWikiTitleModel>
  let metadata: SiteMetadata

  beforeEach(() => {
    metadata = getSiteMetadata()
    WikiTitle = createWikiTitleModel(metadata)
  })

  describe('基本功能', () => {
    it('应该正确创建主命名空间标题', () => {
      const title = new WikiTitle('Hello World')

      expect(title.getMainText()).toBe('Hello World')
      expect(title.getMainDBKey()).toBe('Hello_World')
      expect(title.getPrefixedText()).toBe('Hello World')
      expect(title.getPrefixedDBKey()).toBe('Hello_World')
      expect(title.getNamespaceId()).toBe(0)
      expect(title.getNamespaceText()).toBe('')
    })

    it('应该正确处理带命名空间的标题', () => {
      const title = new WikiTitle('Template:Hello World')

      expect(title.getMainText()).toBe('Hello World')
      expect(title.getMainDBKey()).toBe('Hello_World')
      expect(title.getPrefixedText()).toBe('Template:Hello World')
      expect(title.getPrefixedDBKey()).toBe('Template:Hello_World')
      expect(title.getNamespaceId()).toBe(10)
      expect(title.getNamespaceText()).toBe('Template')
    })

    it('应该正确处理命名空间别名', () => {
      const title1 = new WikiTitle('模板:Hello World')
      const title2 = new WikiTitle('Template:Hello World')

      expect(title1.getNamespaceId()).toBe(10)
      expect(title1.getNamespaceText()).toBe('Template')
      expect(title2.getNamespaceId()).toBe(10)
      expect(title2.getNamespaceText()).toBe('Template')
    })

    it('应该正确处理大小写转换', () => {
      const title = new WikiTitle('Template:hello world')

      expect(title.getMainText()).toBe('Hello world')
      expect(title.getPrefixedText()).toBe('Template:Hello world')
    })
  })

  describe('快捷方法', () => {
    it('toText 应该返回 getPrefixedText 的结果', () => {
      const title = new WikiTitle('Template:Hello World')

      expect(title.toText()).toBe(title.getPrefixedText())
    })

    it('toString 应该返回 getPrefixedDBKey 的结果', () => {
      const title = new WikiTitle('Template:Hello World')

      expect(title.toString()).toBe(title.getPrefixedDBKey())
    })
  })

  describe('Talk 页面功能', () => {
    it('应该正确识别 talk 页面', () => {
      const talkTitle = new WikiTitle('Template talk:Hello World')

      expect(talkTitle.getNamespaceId()).toBe(11)
      expect(talkTitle.getNamespaceText()).toBe('Template talk')
    })

    it('应该从 talk 页面获取主题页面', () => {
      const talkTitle = new WikiTitle('Template talk:Hello World')
      const subjectPage = talkTitle.getSubjectPage()

      expect(subjectPage.getNamespaceId()).toBe(10)
      expect(subjectPage.getMainText()).toBe('Hello World')
      expect(subjectPage.getPrefixedText()).toBe('Template:Hello World')
    })

    it('应该从主题页面获取 talk 页面', () => {
      const subjectTitle = new WikiTitle('Template:Hello World')
      const talkPage = subjectTitle.getTalkPage()

      expect(talkPage).not.toBeNull()
      expect(talkPage!.getNamespaceId()).toBe(11)
      expect(talkPage!.getMainText()).toBe('Hello World')
      expect(talkPage!.getPrefixedText()).toBe('Template talk:Hello World')
    })

    it('talk 页面的 getTalkPage 应该返回自身', () => {
      const talkTitle = new WikiTitle('Template talk:Hello World')
      const talkPage = talkTitle.getTalkPage()

      expect(talkPage).toBe(talkTitle)
    })

    it('主题页面的 getSubjectPage 应该返回自身', () => {
      const subjectTitle = new WikiTitle('Template:Hello World')
      const subjectPage = subjectTitle.getSubjectPage()

      expect(subjectPage).toBe(subjectTitle)
    })

    it('应该处理无法创建 talk 页面的情况', () => {
      const specialTitle = new WikiTitle('Special:SpecialPage') // 特殊页面
      const mediaTitle = new WikiTitle('Media:Image.jpg') // 媒体页面

      const specialTalkPage = specialTitle.getTalkPage()
      const mediaTalkPage = mediaTitle.getTalkPage()

      // 特殊页面和媒体页面通常没有对应的 talk 页面
      expect(specialTalkPage).toBeNull()
      expect(mediaTalkPage).toBeNull()
    })
  })

  describe('URL 生成', () => {
    it('应该生成正确的 URL', () => {
      const title = new WikiTitle('Template:Hello World')
      const url = title.getURL()

      expect(url.toString()).toBe('https://example.com/wiki/Template:Hello_World')
    })

    it('应该正确处理 URL 参数', () => {
      const title = new WikiTitle('Template:Hello World')
      const url = title.getURL({ action: 'edit', section: '1' })

      expect(url.toString()).toBe(
        'https://example.com/wiki/Template:Hello_World?action=edit&section=1'
      )
    })

    it('应该正确处理 URLSearchParams 参数', () => {
      const title = new WikiTitle('Template:Hello World')
      const params = new URLSearchParams({ action: 'edit', section: '1' })
      const url = title.getURL(params)

      expect(url.toString()).toBe(
        'https://example.com/wiki/Template:Hello_World?action=edit&section=1'
      )
    })
  })

  describe('边界情况', () => {
    it('应该处理空标题', () => {
      const title = new WikiTitle('')

      expect(title.getMainText()).toBe('')
      expect(title.getMainDBKey()).toBe('')
      expect(title.getPrefixedText()).toBe('')
      expect(title.getPrefixedDBKey()).toBe('')
    })

    it('应该处理不存在的命名空间', () => {
      const title = new WikiTitle('Nonexistent:hello world')

      // 应该保持原始标题，不解析命名空间
      expect(title.getMainText()).toBe('Nonexistent:hello world')
      expect(title.getNamespaceId()).toBe(0)
    })

    it('应该处理只有冒号的标题', () => {
      const title = new WikiTitle(':Hello World')

      expect(title.getMainText()).toBe('Hello World')
      expect(title.getNamespaceId()).toBe(0)
    })

    it('应该处理多个冒号的标题', () => {
      const title = new WikiTitle('Template:Hello:World')

      expect(title.getMainText()).toBe('Hello:World')
      expect(title.getNamespaceId()).toBe(10)
    })
  })

  describe('缓存机制', () => {
    it('应该为相同的 metadata 返回相同的构造函数', () => {
      const WikiTitle1 = createWikiTitleModel(metadata)
      const WikiTitle2 = createWikiTitleModel(metadata)

      expect(WikiTitle1).toBe(WikiTitle2)
    })

    it('应该为不同的 metadata 对象实例返回不同的构造函数', () => {
      const metadata2 = { ...getSiteMetadata() }
      metadata2.general.sitename = 'Different Wiki'

      const WikiTitle1 = createWikiTitleModel(metadata)
      const WikiTitle2 = createWikiTitleModel(metadata2)

      expect(WikiTitle1).not.toBe(WikiTitle2)
    })
  })

  describe('构造函数参数', () => {
    it('应该正确处理显式命名空间参数', () => {
      const title = new WikiTitle('Hello World', 10)

      expect(title.getMainText()).toBe('Hello World')
      expect(title.getNamespaceId()).toBe(10)
      expect(title.getPrefixedText()).toBe('Template:Hello World')
    })

    it('应该优先使用显式命名空间参数而不是标题中的命名空间', () => {
      const title = new WikiTitle('Template:Hello World', 12) // Help 命名空间

      expect(title.getMainText()).toBe('Template:Hello World')
      expect(title.getNamespaceId()).toBe(12)
      expect(title.getPrefixedText()).toBe('Help:Template:Hello World')
    })
  })

  describe('特殊字符处理', () => {
    it('应该正确处理包含下划线的标题', () => {
      const title = new WikiTitle('Hello_World')

      expect(title.getMainText()).toBe('Hello World')
      expect(title.getMainDBKey()).toBe('Hello_World')
    })

    it('应该正确处理包含空格的标题', () => {
      const title = new WikiTitle('Hello World')

      expect(title.getMainText()).toBe('Hello World')
      expect(title.getMainDBKey()).toBe('Hello_World')
    })
  })

  describe('命名空间标准化测试', () => {
    it('应该正确标准化各种命名空间格式', () => {
      // 这些测试验证 normalizeNamespaceText 函数的行为
      const testCases = [
        { input: 'Template', expected: 'template' },
        { input: 'template', expected: 'template' },
        { input: 'TEMPLATE', expected: 'template' },
        { input: 'Template Talk', expected: 'template_talk' },
        { input: 'template_talk', expected: 'template_talk' },
        { input: 'template talk', expected: 'template_talk' },
        { input: 'template___talk', expected: 'template_talk' },
        { input: 'template_ talk', expected: 'template_talk' },
        { input: '  template  ', expected: 'template' },
        { input: '_template_', expected: 'template' },
        { input: 'tEmPlAtE', expected: 'template' },
      ]

      testCases.forEach(({ input, expected }) => {
        // 通过实际使用 setNamespaceText 来测试标准化功能
        const title = new WikiTitle('Hello World')
        title.setNamespaceText(input)

        // 验证命名空间是否正确识别
        if (input.toLowerCase().includes('template') && !input.toLowerCase().includes('talk')) {
          expect(title.getNamespaceId()).toBe(10)
        } else if (
          input.toLowerCase().includes('template') &&
          input.toLowerCase().includes('talk')
        ) {
          expect(title.getNamespaceId()).toBe(11)
        }
      })
    })

    it('应该处理 MediaWiki 真实行为：大小写不敏感和空格数量不敏感', () => {
      // 基于真实 MediaWiki 行为的测试用例
      const testCases = [
        // Template 命名空间的各种格式
        { input: 'Template', expectedNs: 10 },
        { input: 'template', expectedNs: 10 },
        { input: 'TEMPLATE', expectedNs: 10 },
        { input: 'tEmPlAtE', expectedNs: 10 },
        { input: '  Template  ', expectedNs: 10 },
        { input: 'Template   ', expectedNs: 10 },
        { input: '   template', expectedNs: 10 },

        // Template talk 命名空间的各种格式
        { input: 'Template talk', expectedNs: 11 },
        { input: 'template talk', expectedNs: 11 },
        { input: 'TEMPLATE TALK', expectedNs: 11 },
        { input: 'template_talk', expectedNs: 11 },
        { input: 'Template   talk', expectedNs: 11 },
        { input: 'template  talk', expectedNs: 11 },
        { input: 'TEMPLATE   TALK', expectedNs: 11 },
        { input: 'tEmPlAtE   tAlK', expectedNs: 11 },

        // User 命名空间
        { input: 'User', expectedNs: 2 },
        { input: 'user', expectedNs: 2 },
        { input: 'USER', expectedNs: 2 },
        { input: '  User  ', expectedNs: 2 },
        { input: 'User   ', expectedNs: 2 },

        // User talk 命名空间
        { input: 'User talk', expectedNs: 3 },
        { input: 'user talk', expectedNs: 3 },
        { input: 'USER TALK', expectedNs: 3 },
        { input: 'user_talk', expectedNs: 3 },
        { input: 'User   talk', expectedNs: 3 },
        { input: 'user  talk', expectedNs: 3 },
      ]

      testCases.forEach(({ input, expectedNs }) => {
        const title = new WikiTitle('Hello World')
        title.setNamespaceText(input)
        expect(title.getNamespaceId()).toBe(expectedNs)
      })
    })

    it('应该处理极端情况：多个连续空格和下划线', () => {
      const testCases = [
        { input: 'Template     Talk', expectedNs: 11 },
        { input: 'template_____talk', expectedNs: 11 },
        { input: 'TEMPLATE   ___  TALK', expectedNs: 11 },
        { input: '  template  talk  ', expectedNs: 11 },
        { input: '__template__talk__', expectedNs: 11 },
      ]

      testCases.forEach(({ input, expectedNs }) => {
        const title = new WikiTitle('Hello World')
        title.setNamespaceText(input)
        expect(title.getNamespaceId()).toBe(expectedNs)
      })
    })
  })

  describe('特殊页面别名测试', () => {
    it('应该正确处理特殊页面别名', () => {
      // 假设有特殊页面别名：登录 -> Userlogin
      const title = new WikiTitle('Special:登录')

      // 应该返回真实名称
      expect(title.getMainText()).toBe('Userlogin')
      expect(title.getMainDBKey()).toBe('Userlogin')
      expect(title.getPrefixedText()).toBe('Special:Userlogin')
      expect(title.getPrefixedDBKey()).toBe('Special:Userlogin')
    })

    it('应该正确处理特殊页面别名和子页面', () => {
      // 使用测试数据中的特殊页面别名：编辑 -> EditPage
      const title = new WikiTitle('Special:编辑/页面')

      // 应该返回真实名称 + 子页面
      expect(title.getMainText()).toBe('EditPage/页面')
      expect(title.getMainDBKey()).toBe('EditPage/页面')
      expect(title.getPrefixedText()).toBe('Special:EditPage/页面')
      expect(title.getPrefixedDBKey()).toBe('Special:EditPage/页面')
    })

    it('应该正确处理特殊页面别名和复杂子页面路径', () => {
      // 使用测试数据中的特殊页面别名：编辑 -> EditPage
      const title = new WikiTitle('Special:编辑/foo/bar/baz')

      // 应该返回真实名称 + 完整子页面路径
      expect(title.getMainText()).toBe('EditPage/foo/bar/baz')
      expect(title.getMainDBKey()).toBe('EditPage/foo/bar/baz')
      expect(title.getPrefixedText()).toBe('Special:EditPage/foo/bar/baz')
      expect(title.getPrefixedDBKey()).toBe('Special:EditPage/foo/bar/baz')
    })

    it('应该正确处理特殊页面的大小写不敏感', () => {
      const title1 = new WikiTitle('Special:UsErLoGiN')
      const title2 = new WikiTitle('Special:userlogin')

      expect(title1.getMainText()).toBe('Userlogin')
      expect(title2.getMainText()).toBe('Userlogin')
      expect(title1.getPrefixedText()).toBe('Special:Userlogin')
      expect(title2.getPrefixedText()).toBe('Special:Userlogin')
    })

    it('isSpecial 方法应该正确识别特殊页面', () => {
      const title = new WikiTitle('Special:登录')

      // 应该识别各种别名
      expect(title.isSpecial('登录')).toBe(true)
      expect(title.isSpecial('login')).toBe(true)
      expect(title.isSpecial('Login')).toBe(true)
      expect(title.isSpecial('LOGIN')).toBe(true)
      expect(title.isSpecial('Userlogin')).toBe(true)
      expect(title.isSpecial('userlogin')).toBe(true)

      // 不应该识别其他特殊页面
      expect(title.isSpecial('diff')).toBe(false)
      expect(title.isSpecial('edit')).toBe(false)
    })

    it('isSpecial 方法应该正确处理特殊页面子页面', () => {
      const title = new WikiTitle('Special:Edit/foo')

      // 应该识别主特殊页面
      expect(title.isSpecial('edit')).toBe(true)
      expect(title.isSpecial('Edit')).toBe(true)
      expect(title.isSpecial('EDIT')).toBe(true)

      // 不应该识别其他特殊页面
      expect(title.isSpecial('login')).toBe(false)
      expect(title.isSpecial('diff')).toBe(false)
    })

    it('isSpecial 方法应该处理复杂的子页面路径', () => {
      const title = new WikiTitle('Special:Edit/foo/bar/baz')

      // 应该识别主特殊页面
      expect(title.isSpecial('edit')).toBe(true)
      expect(title.isSpecial('Edit')).toBe(true)

      // 不应该识别其他特殊页面
      expect(title.isSpecial('login')).toBe(false)
    })

    it('isSpecial 方法应该处理非特殊页面', () => {
      const title = new WikiTitle('Template:Hello World')

      // 非特殊页面应该返回 false
      expect(title.isSpecial('login')).toBe(false)
      expect(title.isSpecial('diff')).toBe(false)
    })

    it('应该处理不存在的特殊页面别名', () => {
      const title = new WikiTitle('Special:Nonexistent')

      // 不存在的别名应该保持原样
      expect(title.getMainText()).toBe('Nonexistent')
      expect(title.getMainDBKey()).toBe('Nonexistent')
      expect(title.getPrefixedText()).toBe('Special:Nonexistent')
      expect(title.getPrefixedDBKey()).toBe('Special:Nonexistent')
    })
  })

  describe('新增方法测试', () => {
    describe('setTitle 方法', () => {
      it('应该重置标题和命名空间', () => {
        const title = new WikiTitle('Template:Hello World')
        expect(title.getNamespaceId()).toBe(10)
        expect(title.getMainText()).toBe('Hello World')

        title.setTitle('File:Bar.png')
        expect(title.getNamespaceId()).toBe(6) // File 命名空间
        expect(title.getMainText()).toBe('Bar.png')
        expect(title.getPrefixedText()).toBe('File:Bar.png')
      })

      it('应该支持链式调用', () => {
        const title = new WikiTitle('Template:Hello World')
        const result = title.setTitle('User:Test')

        expect(result).toBe(title)
        expect(title.getNamespaceId()).toBe(2) // User 命名空间
        expect(title.getMainText()).toBe('Test')
      })
    })

    describe('setMainTitle 方法', () => {
      it('应该保持当前命名空间，更新主要标题', () => {
        const title = new WikiTitle('Template:Hello World')
        expect(title.getNamespaceId()).toBe(10)
        expect(title.getMainText()).toBe('Hello World')

        title.setMainText('File:Bar.png')
        expect(title.getNamespaceId()).toBe(10) // 保持 Template 命名空间
        expect(title.getMainText()).toBe('File:Bar.png')
        expect(title.getPrefixedText()).toBe('Template:File:Bar.png')
      })

      it('应该支持链式调用', () => {
        const title = new WikiTitle('Template:Hello World')
        const result = title.setMainText('New Title')

        expect(result).toBe(title)
        expect(title.getNamespaceId()).toBe(10)
        expect(title.getMainText()).toBe('New Title')
      })
    })

    describe('setNamespaceText 方法', () => {
      it('应该通过命名空间文本更新命名空间', () => {
        const title = new WikiTitle('Hello World')
        expect(title.getNamespaceId()).toBe(0)

        title.setNamespaceText('Template')
        expect(title.getNamespaceId()).toBe(10)
        expect(title.getPrefixedText()).toBe('Template:Hello World')
      })

      it('应该支持命名空间别名', () => {
        const title = new WikiTitle('Hello World')
        title.setNamespaceText('模板')
        expect(title.getNamespaceId()).toBe(10)
        expect(title.getPrefixedText()).toBe('Template:Hello World')
      })

      it('应该处理全小写命名空间', () => {
        const title = new WikiTitle('Hello World')
        title.setNamespaceText('template')
        expect(title.getNamespaceId()).toBe(10)
        expect(title.getPrefixedText()).toBe('Template:Hello World')
      })

      it('应该处理全大写命名空间', () => {
        const title = new WikiTitle('Hello World')
        title.setNamespaceText('TEMPLATE')
        expect(title.getNamespaceId()).toBe(10)
        expect(title.getPrefixedText()).toBe('Template:Hello World')
      })

      it('应该处理下划线格式的命名空间', () => {
        const title = new WikiTitle('Hello World')
        title.setNamespaceText('template_talk')
        expect(title.getNamespaceId()).toBe(11)
        expect(title.getPrefixedText()).toBe('Template talk:Hello World')
      })

      it('应该处理空格和下划线混用的命名空间', () => {
        const title = new WikiTitle('Hello World')
        title.setNamespaceText('template_ talk')
        expect(title.getNamespaceId()).toBe(11)
        expect(title.getPrefixedText()).toBe('Template talk:Hello World')
      })

      it('应该处理多个空格和下划线的命名空间', () => {
        const title = new WikiTitle('Hello World')
        title.setNamespaceText('template___talk')
        expect(title.getNamespaceId()).toBe(11)
        expect(title.getPrefixedText()).toBe('Template talk:Hello World')
      })

      it('应该处理首字母大小写不规范的命名空间', () => {
        const title = new WikiTitle('Hello World')
        title.setNamespaceText('tEmPlAtE')
        expect(title.getNamespaceId()).toBe(10)
        expect(title.getPrefixedText()).toBe('Template:Hello World')
      })

      it('应该支持链式调用', () => {
        const title = new WikiTitle('Hello World')
        const result = title.setNamespaceText('Template')

        expect(result).toBe(title)
        expect(title.getNamespaceId()).toBe(10)
      })
    })

    describe('setNamespaceId 方法', () => {
      it('应该通过命名空间 ID 更新命名空间', () => {
        const title = new WikiTitle('Hello World')
        expect(title.getNamespaceId()).toBe(0)

        title.setNamespaceId(10)
        expect(title.getNamespaceId()).toBe(10)
        expect(title.getPrefixedText()).toBe('Template:Hello World')
      })

      it('应该支持链式调用', () => {
        const title = new WikiTitle('Hello World')
        const result = title.setNamespaceId(10)

        expect(result).toBe(title)
        expect(title.getNamespaceId()).toBe(10)
      })
    })

    describe('方法组合使用', () => {
      it('应该支持多个方法的链式调用', () => {
        const title = new WikiTitle('Template:Hello World')

        const result = title
          .setMainText('New Title')
          .setNamespaceText('User')
          .setMainText('Another Title')

        expect(result).toBe(title)
        expect(title.getNamespaceId()).toBe(2) // User 命名空间
        expect(title.getMainText()).toBe('Another Title')
        expect(title.getPrefixedText()).toBe('User:Another Title')
      })

      it('应该正确处理 setTitle 后使用其他方法', () => {
        const title = new WikiTitle('Template:Hello World')

        title.setTitle('File:Bar.png')
        expect(title.getNamespaceId()).toBe(6)
        expect(title.getMainText()).toBe('Bar.png')

        title.setMainText('New File.jpg')
        expect(title.getNamespaceId()).toBe(6) // 保持 File 命名空间
        expect(title.getMainText()).toBe('New File.jpg')
        expect(title.getPrefixedText()).toBe('File:New File.jpg')
      })
    })
  })
})
