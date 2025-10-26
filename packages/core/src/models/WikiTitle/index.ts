import { WikiMetadata } from '@/types/WikiMetadata'

// 使用 WeakMap 避免内存泄漏
const caches = new WeakMap<WikiMetadata, WikiTitleConstructor>()

// 命名空间查找索引
interface NamespaceIndex {
  byName: Map<string, number>
  byCanonical: Map<string, number>
  byAlias: Map<string, number>
  byNormalized: Map<string, number> // 标准化索引：全小写+下划线格式
}

// 特殊页面别名索引
interface SpecialPageIndex {
  byRealName: Map<string, string> // realname -> realname
  byAlias: Map<string, string> // alias -> realname
  byNormalized: Map<string, string> // normalized -> realname
}

export interface IWikiTitle {
  /**
   * Get db key without namespace prefix
   * e.g. "template:hello world" -> "Hello_world"
   */
  getMainDBKey(): string

  /**
   * Get page name without namespace prefix
   * e.g. "template:hello world" -> "Hello world"
   */
  getMainText(): string

  /**
   * Get db key with namespace prefix
   * e.g. "template:hello world" -> "Template:Hello_world"
   */
  getPrefixedDBKey(): string

  /**
   * Get page name with namespace prefix
   * e.g. "template:hello world" -> "Template:Hello world"
   */
  getPrefixedText(): string

  // Shortcuts
  toText: () => string
  toString: () => string

  /**
   * Get namespace ID
   * e.g. "template:hello world" -> 10
   */
  getNamespaceId(): number

  /**
   * Get namespace text
   * e.g. "template:hello world" -> "Template"
   */
  getNamespaceText(): string

  /**
   * Get namespace db key
   * e.g. "template talk:hello world" -> "Template_talk"
   */
  getNamespaceDBKey(): string

  /**
   * Get subject page
   * If current page is subject page, return itself
   * e.g. "template talk:hello world" -> new WikiTitle("Template:Hello world")
   */
  getSubjectPage(): IWikiTitle

  /**
   * Get talk page
   * If current page is talk page, return itself
   * If current page cannot have talk page, return null
   * e.g. "template:hello world" -> new WikiTitle("Template talk:Hello world")
   */
  getTalkPage(): IWikiTitle | null

  /**
   * Get URL of the page
   * e.g. "template:hello world" -> "https://example.com/wiki/Template:Hello_world"
   */
  getURL(params?: Record<string, string> | URLSearchParams): URL

  /**
   * Reset current title with given title string
   */
  setTitle(title: string): IWikiTitle

  /**
   * Set main title, keep current ns, update dbkey
   */
  setMainText(mainTitle: string): IWikiTitle

  /**
   * Set namespace by text
   */
  setNamespaceText(namespaceText: string): IWikiTitle

  /**
   * Set namespace by ID
   */
  setNamespaceId(namespaceId: number): IWikiTitle

  /**
   * Check if the title is equal to another title
   */
  equals(other: IWikiTitle | string): boolean

  /**
   * Check if the title is specific special page
   * e.g. "Special:Diff" is "差异" or "diff" -> true
   */
  isSpecial(alia: string): boolean

  newTitle(title: string, namespace?: number): IWikiTitle
}

export interface WikiTitleConstructor {
  new (title: string, namespace?: number): IWikiTitle
  create(title: string, namespace?: number): IWikiTitle
}

// 工具函数
const titleUtils = {
  toDBKey: (text: string): string => text.replace(/ /g, '_'),
  toNormalText: (text: string): string => text.replace(/_/g, ' '),
  ensureCase: (text: string, caseType: string): string => {
    if (caseType === 'first-letter') {
      return text.charAt(0).toUpperCase() + text.slice(1)
    } else {
      return text
    }
  },
}

// 特殊页面工具函数
const specialPageUtils = {
  /**
   * 标准化特殊页面名称：转换为全小写
   */
  normalizeSpecialPageName: (name: string): string => {
    return name.toLowerCase()
  },

  /**
   * 构建特殊页面别名索引
   */
  buildSpecialPageIndex: (metadata: WikiMetadata): SpecialPageIndex => {
    const byRealName = new Map<string, string>()
    const byAlias = new Map<string, string>()
    const byNormalized = new Map<string, string>()

    for (const specialPage of metadata.specialpagealiases) {
      const realName = specialPage.realname
      byRealName.set(realName, realName)

      // 添加标准化索引
      const normalizedRealName = specialPageUtils.normalizeSpecialPageName(realName)
      byNormalized.set(normalizedRealName, realName)

      // 处理别名
      for (const alias of specialPage.aliases) {
        byAlias.set(alias, realName)

        // 添加标准化的别名索引
        const normalizedAlias = specialPageUtils.normalizeSpecialPageName(alias)
        byNormalized.set(normalizedAlias, realName)
      }
    }

    return { byRealName, byAlias, byNormalized }
  },

  /**
   * 查找特殊页面的真实名称
   */
  findSpecialPageRealName: (name: string, index: SpecialPageIndex): string | null => {
    // 提取主部分（忽略子页面）
    const mainPart = name.split('/')[0]

    // 首先尝试原始输入（精确匹配）
    let result = index.byRealName.get(mainPart) ?? index.byAlias.get(mainPart)
    if (result !== undefined) {
      return result
    }

    // 标准化输入并查找
    const normalized = specialPageUtils.normalizeSpecialPageName(mainPart)
    return index.byNormalized.get(normalized) ?? null
  },
}

// 命名空间工具函数
const namespaceUtils = {
  /**
   * 标准化命名空间文本：转换为全小写+下划线格式
   */
  normalizeNamespaceText: (text: string): string => {
    return text
      .replace(/[_\s]+/g, '_') // 将空格和下划线统一为下划线
      .toLowerCase()
      .replace(/^_+|_+$/g, '') // 移除首尾下划线
  },

  buildIndex: (metadata: WikiMetadata): NamespaceIndex => {
    const byName = new Map<string, number>()
    const byCanonical = new Map<string, number>()
    const byAlias = new Map<string, number>()
    const byNormalized = new Map<string, number>()

    // 构建命名空间索引
    for (const [id, ns] of Object.entries(metadata.namespaces)) {
      const nsId = parseInt(id)
      byName.set(ns.name, nsId)
      byCanonical.set(ns.canonical ?? '', nsId)

      // 添加标准化索引
      const normalizedName = namespaceUtils.normalizeNamespaceText(ns.name)
      const normalizedCanonical = namespaceUtils.normalizeNamespaceText(ns.canonical ?? '')
      byNormalized.set(normalizedName, nsId)
      byNormalized.set(normalizedCanonical, nsId)
    }

    // 构建别名索引
    for (const alias of metadata.namespacealiases) {
      byAlias.set(alias.alias, alias.id)

      // 添加标准化的别名索引
      const normalizedAlias = namespaceUtils.normalizeNamespaceText(alias.alias)
      byNormalized.set(normalizedAlias, alias.id)
    }

    return { byName, byCanonical, byAlias, byNormalized }
  },

  findNamespaceId: (namespaceText: string, index: NamespaceIndex): number | null => {
    // 首先尝试原始输入（精确匹配）
    let result =
      index.byName.get(namespaceText) ??
      index.byCanonical.get(namespaceText) ??
      index.byAlias.get(namespaceText)
    if (result !== undefined) {
      return result
    }

    // 标准化输入并查找
    const normalized = namespaceUtils.normalizeNamespaceText(namespaceText)
    return index.byNormalized.get(normalized) ?? null
  },

  isTalkPage: (ns: number): boolean => ns % 2 === 1 && ns > 0,

  getDefaultNamespaceInfo: (ns: number) => ({
    id: ns,
    name: '',
    canonical: '',
    case: 'first-letter' as const,
    content: false,
    nonincludable: false,
    subpages: false,
  }),
}

export function createWikiTitleModel(metadata: WikiMetadata): WikiTitleConstructor {
  const exists = caches.get(metadata)
  if (exists) {
    return exists
  }

  // 预建命名空间索引
  const namespaceIndex = namespaceUtils.buildIndex(metadata)
  // 预建特殊页面索引
  const specialPageIndex = specialPageUtils.buildSpecialPageIndex(metadata)

  class WikiTitle implements IWikiTitle {
    static readonly _meta = metadata
    static readonly _namespaceIndex = namespaceIndex
    static readonly _specialPageIndex = specialPageIndex

    /** 缓存的 main title，不包含命名空间前缀，大小写和空格状态不确定 */
    #title: string
    /** 缓存的 namespace ID */
    #ns: number

    constructor(title: string, namespace?: number) {
      this.#title = title || ''
      this.#ns = namespace ?? 0

      // 只有在没有显式命名空间参数时才解析标题中的命名空间前缀
      if (namespace === void 0) {
        this.fixNSByTitle()
      }
    }

    static create(title: string, namespace?: number): WikiTitle {
      return new WikiTitle(title, namespace)
    }
    newTitle = WikiTitle.create.bind(WikiTitle)

    private fixNSByTitle(): void {
      const colonIndex = this.#title.indexOf(':')
      if (colonIndex === -1) {
        return // 没有命名空间前缀
      }

      if (colonIndex === 0) {
        // 只有冒号，将冒号后的部分作为标题
        this.#title = this.#title.substring(1)
        return
      }

      const potentialNamespace = this.#title.substring(0, colonIndex)
      const mainTitle = this.#title.substring(colonIndex + 1)

      // 查找匹配的命名空间
      const namespaceId = namespaceUtils.findNamespaceId(
        potentialNamespace,
        WikiTitle._namespaceIndex
      )
      if (namespaceId !== null) {
        this.#title = mainTitle
        this.#ns = namespaceId
      }
    }

    private getNamespaceInfo() {
      return (
        WikiTitle._meta.namespaces[this.#ns] ?? namespaceUtils.getDefaultNamespaceInfo(this.#ns)
      )
    }

    getMainDBKey(): string {
      const nsInfo = this.getNamespaceInfo()

      // 如果是特殊页面，将主部分替换为真实名称，保留子页面部分
      if (this.#ns === -1) {
        const realName = specialPageUtils.findSpecialPageRealName(
          this.#title,
          WikiTitle._specialPageIndex
        )
        if (realName) {
          // 构建包含子页面的完整标题
          const subPage = this.#title.includes('/')
            ? this.#title.substring(this.#title.indexOf('/'))
            : ''
          const fullTitle = realName + subPage
          return titleUtils.ensureCase(titleUtils.toDBKey(fullTitle), nsInfo.case)
        }
      }

      return titleUtils.ensureCase(titleUtils.toDBKey(this.#title), nsInfo.case)
    }

    getMainText(): string {
      const nsInfo = this.getNamespaceInfo()

      // 如果是特殊页面，将主部分替换为真实名称，保留子页面部分
      if (this.#ns === -1) {
        const realName = specialPageUtils.findSpecialPageRealName(
          this.#title,
          WikiTitle._specialPageIndex
        )
        if (realName) {
          // 构建包含子页面的完整标题
          const subPage = this.#title.includes('/')
            ? this.#title.substring(this.#title.indexOf('/'))
            : ''
          const fullTitle = realName + subPage
          return titleUtils.ensureCase(titleUtils.toNormalText(fullTitle), nsInfo.case)
        }
      }

      return titleUtils.ensureCase(titleUtils.toNormalText(this.#title), nsInfo.case)
    }

    private getMainRootText(): string {
      return this.getMainText().split('/')[0]
    }

    getPrefixedDBKey(): string {
      if (this.#ns === 0) {
        return this.getMainDBKey()
      }
      return `${this.getNamespaceDBKey()}:${this.getMainDBKey()}`
    }

    getPrefixedText(): string {
      if (this.#ns === 0) {
        return this.getMainText()
      }
      return `${this.getNamespaceText()}:${this.getMainText()}`
    }

    // aliases
    toText = this.getPrefixedText.bind(this)
    toString = this.getPrefixedDBKey.bind(this)

    getNamespaceId(): number {
      return this.#ns
    }

    getNamespaceText(): string {
      return this.getNamespaceInfo().name ?? ''
    }
    getNamespaceDBKey(): string {
      const nsInfo = this.getNamespaceInfo()
      return titleUtils.ensureCase(titleUtils.toDBKey(this.getNamespaceText()), nsInfo.case)
    }

    getSubjectPage(): IWikiTitle {
      if (namespaceUtils.isTalkPage(this.#ns)) {
        const subjectNs = this.#ns - 1
        return new WikiTitle(this.#title, subjectNs)
      }
      return this
    }

    getTalkPage(): IWikiTitle | null {
      if (namespaceUtils.isTalkPage(this.#ns)) {
        return this
      }

      // 特殊页面和媒体页面没有讨论页
      if (this.#ns < 0) {
        return null
      }

      const talkNs = this.#ns + 1
      const talkNsInfo = WikiTitle._meta.namespaces[talkNs.toString()]
      if (!talkNsInfo) {
        return null
      }

      return new WikiTitle(this.#title, talkNs)
    }

    getURL(params?: Record<string, string> | URLSearchParams): URL {
      const baseUrl = WikiTitle._meta.general.articlepath
      const prefixedDbKey = this.getPrefixedDBKey()

      // 替换 $1 占位符为页面标题，冒号不进行编码
      const path = baseUrl.replace('$1', prefixedDbKey)
      const url = new URL(path, WikiTitle._meta.general.base)

      if (params) {
        const searchParams =
          params instanceof URLSearchParams ? params : new URLSearchParams(params)

        searchParams.forEach((value, key) => {
          url.searchParams.set(key, value)
        })
      }

      return url
    }

    /**
     * 设置标题，重置当前实例的 dbkey 和 ns
     * @param title 新的标题字符串
     */
    setTitle(title: string): this {
      this.#title = title
      this.#ns = 0
      this.fixNSByTitle()
      return this
    }

    setMainText(text: string): this {
      this.#title = text
      return this
    }

    setNamespaceText(namespaceText: string): this {
      const namespaceId = namespaceUtils.findNamespaceId(namespaceText, WikiTitle._namespaceIndex)
      if (namespaceId !== null) {
        this.#ns = namespaceId
      }
      return this
    }

    setNamespaceId(namespaceId: number): this {
      this.#ns = namespaceId
      return this
    }

    equals(other: IWikiTitle | string): boolean {
      if (typeof other === 'string') {
        other = new WikiTitle(other)
      }
      return this.getPrefixedDBKey() === other.getPrefixedDBKey()
    }

    isSpecial(alia: string): boolean {
      // 如果不是特殊页面命名空间，直接返回 false
      if (this.#ns !== -1) {
        return false
      }
      const targetTitle = new WikiTitle(alia, -1)
      return this.getMainRootText() === targetTitle.getMainRootText()
    }
  }

  caches.set(metadata, WikiTitle)
  return WikiTitle
}
