import { Inject, InPageEdit, Logger, Schema, Service } from '@/InPageEdit'
import { I18nManager as I18nManager } from './I18nManager.js'
import { Endpoints } from '@/constants/endpoints.js'

declare module '@/InPageEdit' {
  export interface InPageEdit {
    i18n: I18nService

    /**
     * $ => translate [payload as template]
     * @example
     * ```
     * $`hello, world`
     * // good:    "你好，世界"
     * // missing: "hello, world"
     * $('dragon')`hello, {{ $1 }}`
     * // good:    "你好，dragon"
     * // missing: "hello, dragon"
     * ```
     */
    $: I18nManager['$']
    /**
     * $raw => translateRaw [payload as template]
     * @example
     * ```
     * $raw`hello, {{ $1 }}`
     * // good:    "你好，{{ $1 }}"
     * // missing: "hello, {{ $1 }}"
     * ```
     */
    $raw: I18nManager['$raw']
    /**
     * $$ => message [payload as key]
     * @example
     * ```
     * $$`hello`
     * // good:    "你好"
     * // missing: "(hello)"
     * $$('dragon')`greeting`
     * // good:    "你好，dragon"
     * // missing: "(greeting)"
     * ```
     */
    $$: I18nManager['$$']
    /**
     * $$raw => messageRaw [payload as key]
     * @example
     * ```
     * $$raw`greeting`
     * // good:    "你好，{{ name }}"
     * // missing: "(greeting)"
     * ```
     */
    $$raw: I18nManager['$$raw']
  }
  export interface PreferencesMap {
    language: string
    'i18n.index_url': string
  }
  export interface Events {
    'i18n/changed'(payload: { ctx: InPageEdit; language: string }): void
  }
}

export interface I18nIndex {
  /**
   * 如果指定的语言文件不存在，尝试使用 fallback 语言文件
   * 可以fallback多次，直到找到或者最终fallback到en
   */
  fallbacks: Record<string, string>
  /**
   * 语言代码 - 语言文件
   * "zh-cn": "zh-cn.json"
   * 文件地址相对 index.json
   */
  languages: Record<string, string>
}

@Inject(['wiki', 'preferences'])
@RegisterPreferences(
  Schema.object({
    language: Schema.union(['@user', '@site', Schema.string().description('Custom language code')])
      .description('UI language')
      .default('@user'),
    'i18n.index_url': Schema.string()
      .description('I18n index URL (DO NOT CHANGE THIS) ')
      .default(
        import.meta.env.PROD
          ? Endpoints.I18N_INDEX_URL
          : import.meta.resolve('/src/__mock__/i18n/index.json')
      ),
  })
    .description('UI language preferences')
    .extra('category', 'general')
)
export class I18nService extends Service {
  private readonly logger: Logger
  private indexUrl!: string
  private indexCache: I18nIndex | null = null
  public readonly manager: I18nManager
  constructor(readonly ctx: InPageEdit) {
    super(ctx, 'i18n', false)
    this.logger = this.ctx.logger('I18nService')
    this.manager = new I18nManager(
      {},
      {
        language: 'en',
        globals: {
          getUrl: (...args: Parameters<InPageEdit['wiki']['getUrl']>) => ctx.wiki.getUrl(...args),
        },
      }
    )
  }

  protected async start(): Promise<void> {
    this.indexUrl = (await this.ctx.preferences.get('i18n.index_url')) || ''
    if (!this.indexUrl) {
      this.logger.error('I18n index URL is not set')
      return
    }

    const index = await this.fetchIndex().catch(() => null)

    const prefLang = await this.ctx.preferences.get('language')
    const language = this.resolveLanguage(prefLang)

    this.logger.debug('Settings', { pref: prefLang, resolved: language })

    try {
      const fallbackMap = this.buildFallbackMap(index || undefined)
      this.manager.setFallbacks(fallbackMap)
      await this.ensureLanguageLoaded(language)
      this.manager.setLanguage(language)
      this.logger.info(`Initialized for language: ${this.language}`)
    } catch (e) {
      this.logger.error('Failed to fetch i18n index', e)
      this.manager.setLanguage(language)
    }

    // 当偏好设置中的 language 发生变化时，自动热切换
    this.ctx.on('preferences/changed', async ({ changes }) => {
      if (!('language' in changes)) return
      const next = this.resolveLanguage(changes.language)
      if (next && next !== this.language) {
        await this.switchLanguage(next)
      }
    })

    this.ctx.set('$', this.manager.$.bind(this.manager))
    this.ctx.set('$raw', this.manager.$raw.bind(this.manager))
    this.ctx.set('$$', this.manager.$$.bind(this.manager))
    this.ctx.set('$$raw', this.manager.$$raw.bind(this.manager))
  }

  private resolveLanguage(language: any) {
    if (language === '@user') return this.ctx.wiki.userInfo.options.language
    if (language === '@site') return this.ctx.wiki.siteInfo.general.lang
    return language ? String(language) || 'en' : 'en'
  }

  get language() {
    return this.manager.getLanguage()
  }

  /**
   * 主动设置偏好值（会触发 preferences/changed，从而热切换）
   */
  async setLanguagePreference(value: '@user' | '@site' | string) {
    await this.ctx.preferences.set('language', value as any)
  }

  /**
   * 直接切换到具体语言（不修改偏好值）
   */
  async switchLanguage(language: string) {
    await this.ensureLanguageLoaded(language)
    this.manager.setLanguage(language)
    this.ctx.emit('i18n/changed', { ctx: this.ctx, language: this.language })
  }

  /**
   * 为指定语言注册（或合并）消息。
   * - 推荐加命名空间避免冲突：{ myPlugin: { key: 'value' } }
   * - 若 language 为当前语言，将立即可用；必要时你可以手动触发 UI 刷新或监听 i18n/changed。
   */
  async registerMessages(
    language: string,
    data: Record<string, any>,
    options?: { namespace?: string }
  ) {
    const payload = options?.namespace ? { [options.namespace]: data } : data
    this.manager.setLanguageData(language, payload)
    if (language === this.language) {
      // 不更改语言，仅提示有新消息注入；由调用方决定是否刷新 UI
      this.ctx.emit('i18n/changed', { ctx: this.ctx, language: this.language })
    }
  }

  /**
   * 设置/覆盖回退链表（每个语言对应一串按优先级排列的语言码）。
   * - 直接传递 index.json 的单步回退映射；I18nManager 内部会按同样策略多级回退。
   * - 若未设置，I18nManager 内部默认所有语言最终兜底到 'en'。
   */
  setFallbacks(fallbacks: Record<string, string>) {
    this.manager.setFallbacks(fallbacks)
  }

  /**
   * 列出可用语言与文件（来源于 index.json）
   */
  async getAvailableLanguages(): Promise<Record<string, string>> {
    const index = await this.fetchIndex()
    return index.languages
  }

  private async fetchIndex(): Promise<I18nIndex> {
    if (this.indexCache) return this.indexCache
    const index = (await fetch(this.indexUrl).then((res) => res.json())) as I18nIndex
    this.indexCache = index
    return index
  }

  private async fetchLanguageData(language: string) {
    const index = await this.fetchIndex()
    let lang = language
    let file: string | undefined = index.languages[lang]
    while (!file && index.fallbacks[lang]) {
      lang = index.fallbacks[lang]
      file = index.languages[lang]
    }
    if (file) {
      const data = await fetch(new URL(file, this.indexUrl).toString()).then((res) => res.json())
      return { lang, data }
    } else {
      return { lang, data: {} }
    }
  }

  private async ensureLanguageLoaded(language: string) {
    if (this.manager?.hasLanguage(language)) return
    const data = await this.fetchLanguageData(language)
    this.manager.setLanguageData(data.lang, data.data)
  }

  private buildFallbackMap(index?: I18nIndex) {
    // 直接透传 index.json 的单步映射
    return index?.fallbacks || {}
  }

  /**
   * 获取缺失键报告，形如：
   * { foo: ['zh', 'zh-hans', 'en'] }
   */
  getMissingReport() {
    return this.manager.getMissingReport()
  }

  /**
   * 清空缺失键记录
   */
  clearMissingReport() {
    this.manager.clearMissingReport()
  }
}
