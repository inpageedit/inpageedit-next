/*
 * Browser Logger — keeps console stack traces pointing at the call site
 * Features
 * - Levels: debug < log < info < warn < error < silent
 * - Styled name badge (background color)
 * - Styled group label (color + underline)
 * - Callable instance: logger('group', { color }) to create sub-logger
 * - Dynamic levels via defineLevel(name, { level, label, method })
 * - Global color registry so same name/group always uses the same color
 */

export enum LoggerLevel {
  debug = -1,
  log = 0,
  info = 1,
  warn = 2,
  error = 3,
  silent = 4,
}

type AnyConsoleMethod = 'debug' | 'log' | 'info' | 'warn' | 'error'

export interface LevelDefinition {
  level: LoggerLevel
  /** e.g. "[I]" or "✅" */
  label: string
  /** which console method to use */
  method: AnyConsoleMethod
}

export interface LoggerOptions {
  name?: string
  /** preferred color for the name badge */
  color?: string
  /** minimum enabled level (inclusive). default: LoggerLevel.info */
  level?: LoggerLevel
  /** internal: group path */
  _groupPath?: string[]
  /** internal: inherit dynamic levels */
  _dynamicLevels?: Record<string, LevelDefinition>
  /** internal: share level ref with parent */
  _levelRef?: { value: LoggerLevel }
}

/** A callable Logger: you can call it to create a sub-logger */
export type LoggerCallable = Logger &
  ((group: string, options?: { color?: string }) => LoggerCallable)

// ------------------------
// Global color registry
// ------------------------
const DEFAULT_PALETTE = [
  '#10b981',
  '#3b82f6',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#14b8a6',
  '#f43f5e',
  '#84cc16',
  '#06b6d4',
  '#d946ef',
  '#a3a3a3',
  '#eab308',
  '#22c55e',
  '#f97316',
  '#0ea5e9',
  '#a855f7',
  '#34d399',
  '#f472b6',
]

type ColorKey = `name:${string}` | `group:${string}`

const GLOBAL: any = globalThis as any
if (!GLOBAL.__LOGGER_COLOR_MAP__) GLOBAL.__LOGGER_COLOR_MAP__ = new Map<ColorKey, string>()
const COLOR_MAP: Map<ColorKey, string> = GLOBAL.__LOGGER_COLOR_MAP__

// 保留默认调色板（兼容旧逻辑，当前未直接使用，可作为将来 fallback 或配置入口）

// 计算字符串 hash (FNV-1a 32-bit)
function hashString(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = (h >>> 0) * 0x01000193
  }
  return h >>> 0
}

// 色相桶（精选区间，避免“脏”绿 & 灰橄榄）
const HUE_BUCKETS: Array<[number, number]> = [
  [350, 360],
  [0, 15],
  [15, 30],
  [200, 230],
  [230, 250],
  [250, 280],
  [280, 310],
  [310, 330],
  [140, 160],
  [160, 180],
]

function seededColor(key: ColorKey, kind: 'name' | 'group'): string {
  const hTotal = HUE_BUCKETS.length
  const baseHash = hashString(key)
  const bucketIndex = baseHash % hTotal
  const [hStart, hEnd] = HUE_BUCKETS[bucketIndex]
  const span = hEnd - hStart
  // 再次 hash 混合
  const mixHash = hashString(key + ':' + kind)
  const h = hStart + (mixHash % (span || 1))

  // 依据 kind 派生 S / L
  const h2 = hashString(key + ':s')
  const h3 = hashString(key + ':l')
  let s: number
  let l: number
  if (kind === 'name') {
    s = 62 + (h2 % 18) // 62-79
    l = 30 + (h3 % 12) // 30-41
  } else {
    const warm = (h >= 0 && h < 50) || (h > 330 && h < 360)
    const cool = h >= 200 && h <= 300
    s = 55 + (h2 % 20) // 55-74
    if (cool)
      l = 55 + (h3 % 8) // 55-62
    else if (warm)
      l = 48 + (h3 % 6) // 48-53
    else l = 50 + (h3 % 8) // 50-57
    if (s < 60) s += 5
  }
  return `hsl(${h}, ${s}%, ${l}%)`
}

function pickColor(key: ColorKey, preferred?: string): string {
  if (preferred) {
    COLOR_MAP.set(key, preferred)
    return preferred
  }
  const existing = COLOR_MAP.get(key)
  if (existing) return existing
  // 根据 key 前缀决定颜色类型
  const kind = key.startsWith('name:') ? 'name' : 'group'
  const c = seededColor(key, kind)
  COLOR_MAP.set(key, c)
  return c
}

// ------------------------
// Logger core
// ------------------------
export class Logger {
  private _name?: string
  private _nameColor?: string
  private _groupPath: string[]
  private _dynamicLevels: Record<string, LevelDefinition>
  private _levelRef: { value: LoggerLevel }

  /**
   * Note: constructor returns a callable Proxy so that you can do `logger('group')`.
   */
  constructor(options: LoggerOptions = {}) {
    this._name = options.name
    this._nameColor = options.color
    this._groupPath = options._groupPath ? [...options._groupPath] : []
    this._dynamicLevels = { ...options._dynamicLevels }
    this._levelRef = options._levelRef ?? { value: options.level ?? LoggerLevel.info }

    // Ensure global color is set/overridden when explicit color provided
    if (this._name) pickColor(`name:${this._name}`, this._nameColor)

    // Install default level getters
    this._installBuiltinLevels()

    // Install any inherited dynamic level getters
    for (const k of Object.keys(this._dynamicLevels))
      this._installLevelGetter(k, this._dynamicLevels[k])

    // Return a callable proxy
    return makeCallable(this) as any
  }

  // ---------- public API ----------
  get level(): LoggerLevel {
    return this._levelRef.value
  }
  set level(v: LoggerLevel) {
    this._levelRef.value = v
  }

  /** Create a sub-logger with a group label */
  group(group: string, options?: { color?: string }): LoggerCallable {
    if (group) pickColor(`group:${group}`, options?.color)
    const child = new Logger({
      name: this._name,
      color: this._nameColor,
      _groupPath: [...this._groupPath, group],
      _dynamicLevels: this._dynamicLevels,
      _levelRef: this._levelRef,
    })
    return child as unknown as LoggerCallable
  }

  /** Define a custom level, e.g. logger.defineLevel('success', { level: info, label: '✅', method: 'info' }) */
  defineLevel(name: string, def: LevelDefinition): void {
    this._dynamicLevels[name] = { ...def }
    this._installLevelGetter(name, def)
  }

  // Built-in level getters
  get debug() {
    return this._method('debug')
  }
  get log() {
    return this._method('log')
  }
  get info() {
    return this._method('info')
  }
  get warn() {
    return this._method('warn')
  }
  get error() {
    return this._method('error')
  }

  // ---------- internals ----------
  private _installBuiltinLevels() {
    // nothing to define here because built-ins are getters
    // but we keep default labels for prefix rendering
  }

  private _installLevelGetter(name: string, def: LevelDefinition) {
    // Create lazy getter so prefix/level checks are evaluated at call time
    Object.defineProperty(this, name, {
      configurable: true,
      enumerable: false,
      get: () => this._custom(def),
    })
  }

  private _custom = (def: LevelDefinition) => {
    if (!this._enabled(def.level)) return NOOP
    const [fmt, styles] = this._prefix(def.label)
    const method = this._consoleMethod(def.method)
    return method.bind(console, fmt, ...styles)
  }

  private _method(method: AnyConsoleMethod) {
    const def = BUILTIN_DEFS[method]
    if (!this._enabled(def.level)) return NOOP
    const [fmt, styles] = this._prefix(def.label)
    const fn = this._consoleMethod(method)
    return fn.bind(console, fmt, ...styles)
  }

  private _consoleMethod(method: AnyConsoleMethod): (...args: any[]) => void {
    const m = (console as any)[method] as Function | undefined
    return (m ? m : console.log).bind(console)
  }

  private _enabled(level: LoggerLevel): boolean {
    return level >= this._levelRef.value && this._levelRef.value !== LoggerLevel.silent
  }

  private _prefix(label: string): [string, string[]] {
    const styles: string[] = []
    let fmt = ''

    if (this._name) {
      const color = pickColor(`name:${this._name}`, this._nameColor)
      fmt += `%c${this._name}%c`
      styles.push(
        `background:${color}; color:#fff; padding:1px 4px; border-radius:2px; font-weight:700;`,
        RESET_STYLE
      )
    }

    if (label) {
      // For default labels we include surrounding spaces in the label itself
      fmt += ` ${label}`
    }

    if (this._groupPath.length) {
      const groupText = this._groupPath.join('/')
      const groupColor = pickColor(`group:${groupText}`)
      fmt += ` %c${groupText}%c`
      styles.push(`color:${groupColor}; text-decoration: underline;`, RESET_STYLE)
    }

    return [fmt, styles]
  }
}

const NOOP = () => {}
const RESET_STYLE = 'color:inherit; background:transparent; text-decoration:none;'

const BUILTIN_DEFS: Record<AnyConsoleMethod, LevelDefinition> = {
  debug: { level: LoggerLevel.debug, label: '[D]', method: 'debug' },
  log: { level: LoggerLevel.log, label: '[L]', method: 'log' },
  info: { level: LoggerLevel.info, label: '[I]', method: 'info' },
  warn: { level: LoggerLevel.warn, label: '[W]', method: 'warn' },
  error: { level: LoggerLevel.error, label: '[E]', method: 'error' },
}

function makeCallable(instance: Logger): LoggerCallable {
  const fn = function (group: string, options?: { color?: string }) {
    return instance.group(group, options)
  } as unknown as LoggerCallable
  return new Proxy(fn, {
    get(_t, p, _r) {
      // @ts-ignore
      return (instance as any)[p]
    },
    set(_t, p, v) {
      // @ts-ignore
      ;(instance as any)[p] = v
      return true
    },
    apply(_t, _thisArg, argArray: any[]) {
      return instance.group(argArray[0], argArray[1])
    },
    has(_t, p) {
      return p in instance
    },
  })
}

// ------------------------
// Convenience factory
// ------------------------
export function createLogger(options?: LoggerOptions): LoggerCallable {
  return new Logger(options) as unknown as LoggerCallable
}
