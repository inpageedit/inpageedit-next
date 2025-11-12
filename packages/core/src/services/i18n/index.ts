import { Inject, InPageEdit, Logger, Schema, Service } from '@/InPageEdit'
import { I18nManager as I18nManager } from './I18nManager.js'
import { Endpoints } from '@/constants/endpoints.js'
import { AbstractIPEStorageManager } from '../storage/index.js'

export interface I18nIndexV1 {
  manifest_version: 1
  base_language: string
  last_modified: string
  languages: Record<string, I18nIndexLanguage>
}

export interface I18nIndexLanguage {
  file: string
  fallback?: string
  data?: Record<string, any>
}

export const I18nIndexV1Schema = new Schema<I18nIndexV1>(
  Schema.object({
    manifest_version: Schema.const(1).required(),
    base_language: Schema.string().required(),
    last_modified: Schema.string().required(),
    languages: Schema.dict(
      Schema.object({
        file: Schema.string().required(),
        fallback: Schema.string(),
        data: Schema.transform(Schema.dict(Schema.any()).default({}), (v) =>
          Object.keys(v).length > 0 ? v : undefined
        ),
      })
    ).required(),
  })
)

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

@Inject(['wiki', 'preferences'])
@RegisterPreferences(
  Schema.object({
    'i18n.index_url': Schema.string()
      .description('I18n index URL (DO NOT CHANGE THIS) ')
      .default(
        import.meta.env.PROD
          ? Endpoints.I18N_INDEX_URL
          : import.meta.resolve('/src/__mock__/i18n/index.json')
      ),
  })
    .description('')
    .extra('category', 'general')
)
export class I18nService extends Service {
  private readonly logger: Logger
  private _indexUrl!: string
  private _indexCache: I18nIndexV1 | null = null
  public readonly manager: I18nManager

  private i18nIndexDB: AbstractIPEStorageManager<I18nIndexV1>
  private i18nDataDB: AbstractIPEStorageManager<Record<string, string>>

  $!: I18nManager['$']
  $raw!: I18nManager['$raw']
  $$!: I18nManager['$$']
  $$raw!: I18nManager['$$raw']

  constructor(readonly ctx: InPageEdit) {
    super(ctx, 'i18n', false)
    this.logger = this.ctx.logger('I18nService')
    this.manager = new I18nManager(
      {},
      {
        language: '',
        globals: {
          getUrl: (...args: Parameters<InPageEdit['wiki']['getUrl']>) => ctx.wiki.getUrl(...args),
        },
      }
    )
    this.i18nIndexDB = ctx.storage.createDatabase<I18nIndexV1>(
      'i18n-index',
      1000 * 60 * 60 * 24 * 3, // 3 days
      this.ctx.version,
      'indexedDB'
    )
    this.i18nDataDB = ctx.storage.createDatabase<Record<string, string>>(
      'i18n-data',
      1000 * 60 * 60 * 24 * 3, // 3 days
      this.ctx.version,
      'indexedDB'
    )
    this.$ = this.manager.$.bind(this.manager)
    this.$raw = this.manager.$raw.bind(this.manager)
    this.$$ = this.manager.$$.bind(this.manager)
    this.$$raw = this.manager.$$raw.bind(this.manager)
  }

  protected async start(): Promise<void> {
    // pre-register
    this.ctx.preferences.registerCustomConfig(
      'language',
      Schema.object({
        language: Schema.union([
          '@user',
          '@site',
          Schema.string().description('Custom language code'),
        ])
          .description('UI language')
          .default('@user'),
      }).description('UI language')
    )

    const indexUrl = (this._indexUrl = (await this.ctx.preferences.get('i18n.index_url')) || '')
    if (!indexUrl) {
      this.logger.error('I18n index URL is not set')
      this.setupShortcuts()
      return
    }

    let index: I18nIndexV1 | null = null
    try {
      index = await this.getI18nIndex(indexUrl)
    } catch (e) {
      this.logger.error('Failed to fetch i18n index', e)
      this.setupShortcuts()
      return
    }
    this._indexCache = index
    Object.entries(index.languages).forEach(([code, meta]) => {
      if (meta.data && Object.keys(meta.data).length > 0) {
        this.manager.setLanguageData(code, meta.data)
      }
    })

    const prefer = await this.ctx.preferences.get('language')
    const normalized = this.normalizeLanguageCode(prefer)

    this.logger.debug('Settings', { prefer, normalized })

    try {
      await this.switchLanguage(normalized)
      this.logger.info(`Initialized for language: ${this.language}`)
    } catch (e) {
      this.logger.error('Failed to fetch i18n index', e)
      this.manager.setLanguage('en')
    }

    // rewrite-schema
    this.ctx.preferences.registerCustomConfig(
      'language',
      Schema.object({
        language: Schema.union([
          Schema.const('@user').description(this.$`Same as your personal language`),
          Schema.const('@site').description(this.$`Same as the site language`),
          ...this.getAvailableLanguageCodes().map((code) => Schema.const(code).description(code)),
        ]).default('@user'),
      }).description(this.$`InPageEdit UI language`)
    )

    this.setupShortcuts()

    // 当偏好设置中的 language 发生变化时，自动热切换
    this.ctx.on('preferences/changed', async ({ changes }) => {
      if (!('language' in changes)) return
      const next = this.normalizeLanguageCode(changes.language)
      if (next && next !== this.language) {
        await this.switchLanguage(next)
      }
    })
  }

  private setupShortcuts() {
    if (!this.manager) throw new Error('I18nManager is not initialized')
    this.ctx.set('$', this.manager.$.bind(this.manager))
    this.ctx.set('$raw', this.manager.$raw.bind(this.manager))
    this.ctx.set('$$', this.manager.$$.bind(this.manager))
    this.ctx.set('$$raw', this.manager.$$raw.bind(this.manager))
  }

  private normalizeLanguageCode(code: any) {
    if (!code || typeof code !== 'string') return 'en'
    if (code === '@user') code = this.ctx.wiki.userInfo.options.language || 'en'
    if (code === '@site') code = this.ctx.wiki.siteInfo.general.lang || 'en'
    return paramCase(String(code)).toLowerCase()
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
    const lang = this.normalizeLanguageCode(language)
    await this.ensureLanguageLoaded(lang)
    this.manager.setLanguage(lang)
    this.ctx.emit('i18n/changed', { ctx: this.ctx, language: lang })
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
   * 列出可用语言与文件（来源于 index.json）
   */
  getAvailableLanguageCodes(): string[] {
    if (!this._indexCache) throw new Error('I18n index is not loaded')
    return Object.entries(this._indexCache.languages)
      .filter(([_, meta]) => !meta.fallback)
      .reduce((acc, [code, _]) => {
        acc.push(code)
        return acc
      }, [] as string[])
  }

  private findLanguageMeta(
    index: I18nIndexV1,
    language: string
  ): (I18nIndexLanguage & { code: string }) | undefined {
    const normalized = paramCase(String(language)).toLowerCase()
    const found = index.languages[normalized]
    if (found) {
      return {
        code: normalized,
        ...found,
      }
    } else {
      const en = index.languages['en']
      if (en) {
        return {
          code: 'en',
          ...en,
        }
      }
    }
  }

  public async getI18nIndex(url: string, noCache = false): Promise<I18nIndexV1> {
    if (!noCache) {
      const cached = await this.i18nIndexDB.get(url)
      if (cached) {
        try {
          return I18nIndexV1Schema(cached)
        } catch (e) {
          this.logger.error('Failed to parse cached i18n index', e)
          this.i18nIndexDB.delete(url)
        }
      }
    }
    const index = await this.fetchI18nIndex(url)
    this.i18nIndexDB.set(url, index)
    return index
  }
  private async fetchI18nIndex(url: string): Promise<I18nIndexV1> {
    const index = (await fetch(url).then((res) => res.json())) as I18nIndexV1
    return I18nIndexV1Schema(index)
  }

  private async ensureLanguageLoaded(language: string) {
    if (!this.manager || !this._indexCache) throw new Error('I18nManager is not initialized')
    if (this.manager.hasLanguage(language)) {
      return this.logger.debug('Language already loaded', language)
    }
    const data = await this.getLanguageData(language)
    this.manager.setLanguageData(language, data)
    this.logger.debug('Language data ensured', language, data)
  }

  public async getLanguageData(language: string, noCache = false): Promise<Record<string, string>> {
    if (!this._indexCache) throw new Error('I18n index is not loaded')
    const meta = this.findLanguageMeta(this._indexCache, language)
    if (!meta) return {}

    const key = `${this._indexUrl}#${meta.file}`
    if (!noCache) {
      const cached = await this.i18nDataDB.get(key)
      if (cached && Object.keys(cached).length > 0) {
        this.logger.debug('Using cached language data', language, cached)
        return cached
      }
    }

    const data =
      meta.data ||
      (await fetch(new URL(meta.file, this._indexUrl).toString()).then((res) => res.json()))

    this.i18nDataDB.set(key, data)
    this.logger.debug('Language data fetched', language, meta.file, data)

    return data
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
