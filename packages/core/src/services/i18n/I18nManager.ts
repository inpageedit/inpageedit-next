import { createInterpolate } from './interpolate.js'
import type { Interpolator } from './interpolate.js'

export class I18nManager {
  private languages = new Map<string, Map<string, string>>()
  private currentLanguage = 'en'
  private fallbacks: Record<string, string> = {}
  // 记录缺失键与其在各语言链上缺失的语言码（保持首次加入顺序，避免重复）
  private missingKeys = new Map<string, string[]>()
  interpolate: Interpolator
  constructor(
    init?: Record<string, any>,
    options?: {
      language?: string
      fallbacks?: Record<string, string>
      globals?: Record<string, unknown>
    }
  ) {
    const lang = options?.language || 'en'
    this.currentLanguage = lang
    if (options?.fallbacks) {
      this.setFallbacks(options.fallbacks)
    }
    this.interpolate = createInterpolate(options?.globals)
    if (init && Object.keys(init).length) {
      this.setLanguageData(lang, init)
    }
  }

  setGlobals(globals: Record<string, unknown>) {
    this.interpolate = createInterpolate(globals)
    return this
  }

  /**
   * ```
   * { foo: 'foo', bar: { baz: 'qux' } }
   * ```
   * will be merged into
   * ```
   * { foo: 'foo', 'bar.baz': 'qux' }
   * ```
   */
  set(key: string, value: string): this
  set(data: Record<string, any>): this
  set(arg1: string | Record<string, any>, arg2?: string): this {
    const lang = this.currentLanguage
    const dict = this.ensureLanguageMap(lang)
    if (typeof arg1 === 'string' && typeof arg2 === 'string') {
      dict.set(arg1, arg2)
    } else if (typeof arg1 === 'object') {
      const flat = this.toStringRecord(arg1)
      for (const [k, v] of Object.entries(flat)) {
        dict.set(k, v)
      }
    }
    return this
  }

  setLanguageData(language: string, data: Record<string, any>): this {
    language = paramCase(language).toLowerCase()
    const dict = this.ensureLanguageMap(language)
    const flat = this.toStringRecord(data)
    for (const [k, v] of Object.entries(flat)) {
      dict.set(k, v)
    }
    return this
  }

  setFallbacks(fallbacks?: Record<string, string>) {
    const normalized = Object.fromEntries(
      Object.entries(fallbacks || {}).map(([k, v]) => [
        paramCase(k).toLowerCase(),
        paramCase(v).toLowerCase(),
      ])
    )
    this.fallbacks = normalized
    return this
  }

  setLanguage(language: string) {
    language = paramCase(language).toLowerCase()
    this.currentLanguage = language
    return this
  }

  getLanguage() {
    return this.currentLanguage
  }

  hasLanguage(language: string) {
    return this.languages.has(language)
  }

  private toStringRecord(data: Record<string, any>, prefix?: string): Record<string, string> {
    const result: Record<string, string> = {}
    for (const [key, value] of Object.entries(data)) {
      const nextKey = prefix ? `${prefix}.${key}` : key
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const nested = this.toStringRecord(value as Record<string, any>, nextKey)
        for (const [nk, nv] of Object.entries(nested)) {
          result[nk] = String(nv)
        }
      } else {
        result[nextKey] = String(value)
      }
    }
    return result
  }

  has(key: string) {
    const langs = this.resolveLanguageOrder(this.currentLanguage)
    for (const lg of langs) {
      const dict = this.languages.get(lg)
      if (dict?.has(key)) return true
    }
    return false
  }

  get(key: string) {
    const langs = this.resolveLanguageOrder(this.currentLanguage)
    const missing: string[] = []
    for (const lg of langs) {
      const dict = this.languages.get(lg)
      const val = dict?.get(key)
      if (typeof val !== 'undefined') {
        if (missing.length) this.recordMissing(key, missing)
        return val
      }
      missing.push(lg)
    }
    // 全链均未命中，记录整条链
    if (missing.length) this.recordMissing(key, missing)
    return undefined
  }

  /**
   * Interpolate a message with optional arguments
   * If the message is not found, the key will be used as the template
   * @example
   * ```
   * i18n.msg('Hello, {{ name }}', 'dragon')
   * // key exists: "你好，dragon"
   * // key not exists: "Hello, dragon"
   * ```
   */
  translate(msg: string): string
  translate(msg: string, context: Record<string, unknown>): string
  translate(msg: string, ...numricContext: string[]): string
  translate(msg: string, numricContext: string[]): string
  translate(msg: string, ...args: Array<unknown>): string {
    if (!msg) {
      return ''
    }
    if (this.currentLanguage === 'qqx') {
      return `⧼${msg}⧽`
    }
    const template = this.get(msg)
    if (typeof template === 'undefined') {
      return this.interpolate(msg, ...(args as any))
    }
    return this.interpolate(template, ...(args as any))
  }
  $ = this.translate.bind(this)

  // Do not interpolate, just return the raw message
  translateRaw(msg: string): string {
    if (!msg) {
      return ''
    }
    if (this.currentLanguage === 'qqx') {
      return `⧼${msg}⧽`
    }
    const template = this.get(msg)
    return template ?? msg
  }
  $raw = this.translateRaw.bind(this)

  /**
   * Interpolate a message by key with optional arguments
   * If the message is not found, the placeholder will be returned
   * @example
   * ```
   * i18n.strictMsg('greeting', 'dragon')
   * // key exists: "你好，dragon"
   * // key not exists: "(greeting)"
   * ```
   */
  message(key: string): string
  message(key: string, context: Record<string, unknown>): string
  message(key: string, ...numricContext: string[]): string
  message(key: string, numricContext: string[]): string
  message(key: string, ...args: Array<unknown>): string {
    if (!key) {
      return ''
    }
    if (this.currentLanguage === 'qqx') {
      return `⧼${key}⧽`
    }
    const template = this.get(key)
    if (typeof template === 'undefined') {
      return `(${key})`
    }
    return this.interpolate(template, ...(args as any))
  }
  $$ = this.message.bind(this)

  messageRaw(key: string): string {
    if (!key) {
      return ''
    }
    if (this.currentLanguage === 'qqx') {
      return `⧼${key}⧽`
    }
    const template = this.get(key)
    return template ?? `(${key})`
  }
  $$raw = this.messageRaw.bind(this)

  getAvailableLanguages() {
    return Array.from(this.languages.keys())
  }

  private ensureLanguageMap(language: string) {
    let dict = this.languages.get(language)
    if (!dict) {
      dict = new Map<string, string>()
      this.languages.set(language, dict)
    }
    return dict
  }

  private resolveLanguageOrder(language: string) {
    const order: string[] = []
    const visited = new Set<string>()
    const push = (lg: string) => {
      if (!visited.has(lg)) {
        visited.add(lg)
        order.push(lg)
      }
    }
    push(language)
    // 按单步映射多级回退，例如 zh-hk -> zh-hant -> zh-hans
    const seen = new Set<string>()
    let cur = language
    while (true) {
      const next = this.fallbacks[cur]
      if (!next) break
      if (seen.has(next)) break
      seen.add(next)
      push(next)
      cur = next
    }
    if (!visited.has('en')) order.push('en')
    return order
  }

  /**
   * 获取缺失键报告：
   * { foo: ['zh', 'zh-hans', 'en'] }
   */
  getMissingReport() {
    return Object.fromEntries(this.missingKeys.entries())
  }

  /**
   * 清空缺失键记录
   */
  clearMissingReport() {
    this.missingKeys.clear()
  }

  private recordMissing(key: string, langs: string[]) {
    if (!langs.length) return
    const list = this.missingKeys.get(key) || []
    for (const lg of langs) {
      if (!list.includes(lg)) list.push(lg)
    }
    this.missingKeys.set(key, list)
  }
}
