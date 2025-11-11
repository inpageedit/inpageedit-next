import { createInterpolate } from './interpolate.js'
import type { Interpolator } from './interpolate.js'

function joinTemplateStrings(strings: TemplateStringsArray, values: Array<unknown>) {
  let out = strings[0] ?? ''
  for (let i = 0; i < values.length; i++) {
    out += String(values[i]) + (strings[i + 1] ?? '')
  }
  return out
}

export class I18nManager {
  private languages = new Map<string, Map<string, string>>()
  private currentLanguage = 'en'
  /**
   * 回退映射
   * @example ```
   * {
   *  "zh": "zh-hans",
   *  "zh-classical": "lzh",
   *  "zh-cn": "zh-hans",
   *  "zh-hant": "zh-hans",
   *  "zh-hk": "zh-hant"
   * }
   * 回退：zh-hk -> zh-hant -> zh-hans -> en // 最终回退到 en
   * ```
   */
  private fallbacks: Record<string, string> = {}
  // 记录某个键在哪些语言中缺失了
  private missingKeys = new Map<string, string[]>()
  // 记录已使用的所有键
  private usedKeys = new Set<string>()
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
    language = paramCase(language).toLowerCase()
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
    this.recordUsedKey(key)
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
   * [payload as template] Interpolate a message with optional arguments
   * @example
   * ```
   * i18n.msg('Hello, {{ name }}', 'dragon')
   * // good:    "你好，dragon"
   * // missing: "Hello, dragon"
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
  /**
   * $ => translate
   * @example
   * ```
   * $`hello, world` // "你好，世界"
   * $('dragon')`hello, {{ $1 }}` // "你好，dragon"
   */
  $(
    context: Record<string, unknown>
  ): (strings: TemplateStringsArray, ...values: unknown[]) => string
  $(...numricContext: string[]): (strings: TemplateStringsArray, ...values: unknown[]) => string
  $(strings: TemplateStringsArray, ...values: unknown[]): string
  $(...args: any[]): any {
    const isTagCall = Array.isArray(args[0]) && (args[0] as any)?.raw
    if (isTagCall) {
      // 直接作为模板标签使用：$`...`
      const strings = args[0] as TemplateStringsArray
      const values = args.slice(1)
      const msg = joinTemplateStrings(strings, values)
      return this.translate(msg)
    }
    // 先传上下文/位置参数，返回模板标签函数：$({...})`...` / $('a','b')`...`
    const capturedArgs = args
    return (strings: TemplateStringsArray, ...values: unknown[]) => {
      const msg = joinTemplateStrings(strings, values)
      return this.translate(msg, ...(capturedArgs as any))
    }
  }

  /**
   * [payload as template] Return the raw message without interpolation
   * @example
   * ```
   * i18n.rawMsg('Hello, {{ name }}')
   * // good:    "你好，{{ name }}"
   * // missing: "Hello, {{ name }}"
   * ```
   */
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
  /**
   * $raw => translateRaw
   * @example
   * ```
   * $raw`hello, {{ $1 }}`
   * // good:    "你好，{{ $1 }}"
   * // missing: "hello, {{ $1 }}"
   * ```
   */
  $raw(
    _context: Record<string, unknown>
  ): (strings: TemplateStringsArray, ...values: unknown[]) => string
  $raw(..._numricContext: string[]): (strings: TemplateStringsArray, ...values: unknown[]) => string
  $raw(strings: TemplateStringsArray, ...values: unknown[]): string
  $raw(...args: any[]): any {
    const isTagCall = Array.isArray(args[0]) && (args[0] as any)?.raw
    if (isTagCall) {
      const strings = args[0] as TemplateStringsArray
      const values = args.slice(1)
      const msg = joinTemplateStrings(strings, values)
      return this.translateRaw(msg)
    }
    return (strings: TemplateStringsArray, ...values: unknown[]) => {
      const msg = joinTemplateStrings(strings, values)
      return this.translateRaw(msg)
    }
  }

  /**
   * [payload as key] Interpolate a message by key with optional arguments
   * @example
   * ```
   * i18n.strictMsg('greeting', 'dragon')
   * // good:    "你好，dragon"
   * // missing: "(greeting)"
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
  /**
   * $$ => message
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
  $$(
    context: Record<string, unknown>
  ): (strings: TemplateStringsArray, ...values: unknown[]) => string
  $$(...numricContext: string[]): (strings: TemplateStringsArray, ...values: unknown[]) => string
  $$(strings: TemplateStringsArray, ...values: unknown[]): string
  $$(...args: any[]): any {
    const isTagCall = Array.isArray(args[0]) && (args[0] as any)?.raw
    if (isTagCall) {
      const strings = args[0] as TemplateStringsArray
      const values = args.slice(1)
      const key = joinTemplateStrings(strings, values)
      return this.message(key)
    }
    const capturedArgs = args
    return (strings: TemplateStringsArray, ...values: unknown[]) => {
      const key = joinTemplateStrings(strings, values)
      return this.message(key, ...(capturedArgs as any))
    }
  }

  /**
   * [payload as key] Return the raw message without interpolation
   * @example
   * ```
   * i18n.rawMsg('greeting')
   * // good:    "你好，{{ name }}"
   * // missing: "(greeting)"
   * ```
   */
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
  /**
   * $$raw => messageRaw
   * @example
   * ```
   * $$raw`greeting`
   * // good:    "你好，{{ name }}"
   * // missing: "(greeting)"
   * ```
   */
  $$raw(
    _context: Record<string, unknown>
  ): (strings: TemplateStringsArray, ...values: unknown[]) => string
  $$raw(
    ..._numricContext: string[]
  ): (strings: TemplateStringsArray, ...values: unknown[]) => string
  $$raw(strings: TemplateStringsArray, ...values: unknown[]): string
  $$raw(...args: any[]): any {
    const isTagCall = Array.isArray(args[0]) && (args[0] as any).raw
    if (isTagCall) {
      const strings = args[0] as TemplateStringsArray
      const values = args.slice(1)
      const key = joinTemplateStrings(strings, values)
      return this.messageRaw(key)
    }
    return (strings: TemplateStringsArray, ...values: unknown[]) => {
      const key = joinTemplateStrings(strings, values)
      return this.messageRaw(key)
    }
  }

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

  private recordUsedKey(key: string) {
    this.usedKeys.add(key)
  }

  private getUsedKeys() {
    return Array.from(this.usedKeys)
  }
  private generateBlankKeyRecord() {
    const record: Record<string, string> = {}
    for (const key of this.getUsedKeys()) {
      record[key] = ''
    }
    return record
  }
}
