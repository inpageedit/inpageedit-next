/**
 * Browser Logger — tiny extensible logger for the browser.
 *
 * Goals:
 * - Support `new Logger({...})` AND callable instances: `logger('group', opts?)`.
 * - Log levels with threshold filtering; per-call override via `{ print: true }`.
 * - Prefix (app name) and nested groups with colorized labels (CSS `%c`).
 * - Deterministic colors per label; overrideable, last-set wins.
 * - Custom levels (e.g., success, debug) with `logger.defineLevel(...)`.
 * - Extensible via lightweight hooks.
 *
 * Usage:
 *   const logger = new Logger({ level: 2, name: 'MyApp', color: 'green' });
 *   logger.info('message', { any: 'value' });
 *   const group = logger('group', { color: 'blue' });
 *   group.warn('message');
 *   logger.defineLevel('success', { rank: 1, label: 'S', method: 'info' });
 *   logger.success('Saved!', { id: 123 }, { print: true });
 */

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------
export type ConsoleMethod = 'log' | 'info' | 'warn' | 'error'

export interface LevelDef {
  /** Severity rank. Lower = less severe. Only messages with rank >= logger.level print, unless per-call {print:true}. */
  rank: number
  /** Badge shown like [I], [W]. */
  label?: string
  /** console method used for emission. */
  method?: ConsoleMethod
}

export enum LoggerLevelRank {
  debug = -1,
  log = 0,
  info = 1,
  warn = 2,
  error = 3,
  silent = 4,
}

export interface LoggerOptions {
  /** Minimum severity to print: 0 log, 1 info, 2 warn, 3 error. */
  level?: LoggerLevelRank | number
  /** App prefix. Can be empty string to omit. */
  name?: string
  /** CSS color for the prefix. If omitted, deterministic color will be chosen. */
  color?: string
  /** Quick on/off switch. */
  enabled?: boolean
  /** Optional custom levels at construction time. */
  levels?: Record<string, LevelDef>
}

export interface GroupOptions {
  /** CSS color for the group label. */
  color?: string
}

export interface LogCallOptions {
  /** Force printing this call even if below the threshold. */
  print?: boolean
}

export interface Hooks {
  /** Called right before emitting. Return false to cancel. */
  beforeEmit?: (payload: EmitPayload) => boolean | void
  /** Called after a successful emit. */
  afterEmit?: (payload: EmitPayload) => void
}

export interface EmitPayload {
  level: string
  rank: number
  method: ConsoleMethod
  prefix?: string
  groupPath: string[]
  args: unknown[]
  enabled: boolean
  willPrint: boolean
}

// ------------------------------------------------------------
// Utilities: color registry & helpers
// ------------------------------------------------------------
const console = (globalThis as any)['con'.concat('sole')] as Console // avoid console stripping

const explicitColor = new Map<string, string>() // last-set wins

function setLabelColor(label: string, color: string) {
  explicitColor.set(label, color)
}

function getLabelColor(label: string): string {
  const found = explicitColor.get(label)
  if (found) return found
  const color = pickDeterministicColor(label)
  // Do not cache auto-colors in explicitColor to allow future overrides without confusion.
  return color
}

function pickDeterministicColor(key: string): string {
  // Simple string hash -> [0, 360)
  let h = 2166136261 >>> 0 // FNV-ish
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const hue = h % 360
  const sat = 65 // pleasant saturation
  const light = 45 // readable on light/dark backgrounds
  return `hsl(${hue}, ${sat}%, ${light}%)`
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return !!x && Object.prototype.toString.call(x) === '[object Object]'
}

function maybeExtractCallOptions(args: unknown[]): { args: unknown[]; opts: LogCallOptions } {
  if (args.length === 0) return { args, opts: {} }
  const last = args[args.length - 1]
  if (
    isPlainObject(last) &&
    'print' in last &&
    Object.keys(last as any).every((k) => k === 'print')
  ) {
    const copy = args.slice(0, -1)
    return { args: copy, opts: last as LogCallOptions }
  }
  return { args, opts: {} }
}

// ------------------------------------------------------------
// Default levels
// ------------------------------------------------------------
const DEFAULT_LEVELS: Record<string, LevelDef> = {
  log: { rank: 0, label: 'L', method: 'log' },
  info: { rank: 1, label: 'I', method: 'info' },
  warn: { rank: 2, label: 'W', method: 'warn' },
  error: { rank: 3, label: 'E', method: 'error' },
}

// ------------------------------------------------------------
// Core implementation
// ------------------------------------------------------------
interface InternalState {
  level: number
  enabled: boolean
  name?: string // prefix
  nameColor?: string
  // groups is a path ['group', 'sub'] for nested group instances
  groups: { label: string; color?: string }[]
  levels: Map<string, Required<LevelDef>> // merged levels
  hooks: Hooks
}

function cloneState(state: InternalState): InternalState {
  return {
    level: state.level,
    enabled: state.enabled,
    name: state.name,
    nameColor: state.nameColor,
    groups: state.groups.slice(),
    levels: new Map(state.levels),
    hooks: { ...state.hooks },
  }
}

// The concrete callable instance shape
export interface LoggerInstance {
  readonly isLogger: true
  /** Current threshold. Set like: logger.level = 2 */
  level: number
  /** Toggle output. */
  enabled: boolean
  /** Prefix name (app). */
  name?: string
  /** Explicit prefix color. */
  color?: string

  // Base methods
  log: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
  /** Emit at a specific level name. */
  at: (levelName: string, ...args: unknown[]) => void

  /** Define or override a level and create a convenience method. */
  defineLevel: (name: string, def: LevelDef) => void

  /** Return a child logger under a group (also available via calling the instance). */
  group: (label: string, opts?: GroupOptions) => Logger

  /** Register hooks. Any missing callbacks keep their previous values. */
  setHooks: (hooks: Hooks) => void

  /** Assign or override colors for labels (prefix/groups). */
  setLabelColor: (label: string, color: string) => void
}

// Callable signature (for grouping via function call)
export interface LoggerCallable {
  (label: string, opts?: GroupOptions): Logger
}

export type Logger = LoggerInstance & LoggerCallable

// Public constructor type (so TS accepts `new Logger(...)`)
export const Logger: {
  new (opts?: LoggerOptions): Logger
  /** Helper factory without `new` */
  create: (opts?: LoggerOptions) => Logger
} = function LoggerConstructor(this: any, opts?: LoggerOptions): Logger {
  return createLogger(opts)
} as any
;(Logger as any).create = (opts?: LoggerOptions) => createLogger(opts)

// Build the actual instance
function createLogger(opts: LoggerOptions = {}): Logger {
  const state: InternalState = {
    level: opts.level ?? 0,
    enabled: opts.enabled ?? true,
    name: opts.name,
    nameColor: opts.color,
    groups: [],
    levels: new Map(
      Object.entries({ ...DEFAULT_LEVELS, ...(opts.levels ?? {}) }).map(([k, v]) => [
        k,
        withDefaults(v),
      ])
    ),
    hooks: {},
  }

  if (state.name && state.nameColor) setLabelColor(state.name, state.nameColor)

  // The callable that creates a grouped child logger
  const callable = ((label: string, gopts?: GroupOptions) =>
    makeChild(callable, state, label, gopts)) as unknown as Logger

  // Attach instance API via property definitions to keep callability
  defineLoggerAPI(callable, state)

  // Attach default methods for known levels and keep them updated on defineLevel
  for (const levelName of state.levels.keys()) {
    attachLevelMethod(callable, state, levelName)
  }

  return callable
}

function withDefaults(def: LevelDef): Required<LevelDef> {
  return {
    rank: def.rank,
    label: def.label ?? defRankToDefaultLabel(def.rank),
    method: def.method ?? rankToDefaultMethod(def.rank),
  }
}

function rankToDefaultMethod(rank: number): ConsoleMethod {
  if (rank >= 3) return 'error'
  if (rank === 2) return 'warn'
  if (rank === 1) return 'info'
  return 'log'
}

function defRankToDefaultLabel(rank: number): string {
  switch (rank) {
    case 3:
      return 'E'
    case 2:
      return 'W'
    case 1:
      return 'I'
    default:
      return 'L'
  }
}

function defineLoggerAPI(target: Logger, state: InternalState) {
  Object.defineProperties(target, {
    isLogger: { value: true, enumerable: false },

    level: {
      get() {
        return state.level
      },
      set(v: number) {
        state.level = v | 0
      },
      enumerable: true,
      configurable: false,
    },

    enabled: {
      get() {
        return state.enabled
      },
      set(v: boolean) {
        state.enabled = !!v
      },
      enumerable: true,
      configurable: false,
    },

    name: {
      get() {
        return state.name
      },
      set(v: string | undefined) {
        state.name = v
      },
      enumerable: true,
      configurable: false,
    },

    color: {
      get() {
        return state.nameColor
      },
      set(v: string | undefined) {
        state.nameColor = v
        if (state.name && v) setLabelColor(state.name, v)
      },
      enumerable: true,
      configurable: false,
    },

    group: {
      value: (label: string, gopts?: GroupOptions) => makeChild(target, state, label, gopts),
      enumerable: false,
    },

    at: {
      value: (levelName: string, ...args: unknown[]) => emitAt(target, state, levelName, args),
      enumerable: false,
    },

    defineLevel: {
      value: (name: string, def: LevelDef) => {
        state.levels.set(name, withDefaults(def))
        attachLevelMethod(target, state, name) // (re)attach the convenience method
      },
      enumerable: false,
    },

    setHooks: {
      value: (hooks: Hooks) => {
        state.hooks = { ...state.hooks, ...hooks }
      },
      enumerable: false,
    },

    setLabelColor: {
      value: (label: string, color: string) => setLabelColor(label, color),
      enumerable: false,
    },
  })

  // Also attach the four base methods by default (log/info/warn/error)
  for (const base of ['log', 'info', 'warn', 'error'] as const) {
    if (!(base in (target as any))) attachLevelMethod(target, state, base)
  }
}

function attachLevelMethod(target: Logger, state: InternalState, levelName: string) {
  Object.defineProperty(target, levelName, {
    value: (...args: unknown[]) => emitAt(target, state, levelName, args),
    enumerable: false,
    configurable: true,
  })
}

function makeChild(
  parent: Logger,
  parentState: InternalState,
  label: string,
  gopts?: GroupOptions
): Logger {
  const childState = cloneState(parentState)
  childState.groups.push({ label, color: gopts?.color })
  if (gopts?.color) setLabelColor(label, gopts.color)

  const callable = ((sub: string, subopts?: GroupOptions) =>
    makeChild(callable, childState, sub, subopts)) as unknown as Logger
  defineLoggerAPI(callable, childState)
  for (const levelName of childState.levels.keys()) {
    attachLevelMethod(callable, childState, levelName)
  }
  return callable
}

function emitAt(self: Logger, state: InternalState, levelName: string, rawArgs: unknown[]) {
  const def = state.levels.get(levelName)
  if (!def) {
    // Unknown level: treat as console.log without threshold.
    const { args } = maybeExtractCallOptions(rawArgs)
    const payload: EmitPayload = {
      level: levelName,
      rank: Number.NEGATIVE_INFINITY,
      method: 'log',
      prefix: state.name,
      groupPath: state.groups.map((g) => g.label),
      args,
      enabled: state.enabled,
      willPrint: state.enabled,
    }
    if (state.hooks.beforeEmit && state.hooks.beforeEmit(payload) === false) return
    emitToConsole(
      {
        method: 'log',
        prefix: state.name,
        prefixColor: resolvePrefixColor(state),
        groups: state.groups,
      },
      levelName,
      args
    )
    state.hooks.afterEmit?.(payload)
    return
  }

  const { args, opts } = maybeExtractCallOptions(rawArgs)
  const willPrint = state.enabled && (def.rank >= state.level || !!opts.print)

  const payload: EmitPayload = {
    level: levelName,
    rank: def.rank,
    method: def.method,
    prefix: state.name,
    groupPath: state.groups.map((g) => g.label),
    args,
    enabled: state.enabled,
    willPrint,
  }

  if (state.hooks.beforeEmit && state.hooks.beforeEmit(payload) === false) return
  if (!willPrint) return // filtered out

  emitToConsole(
    {
      method: def.method,
      prefix: state.name,
      prefixColor: resolvePrefixColor(state),
      groups: state.groups,
      levelBadge: def.label ?? levelName,
    },
    undefined,
    args
  )

  state.hooks.afterEmit?.(payload)
}

function resolvePrefixColor(state: InternalState): string | undefined {
  if (!state.name) return undefined
  return state.nameColor ?? getLabelColor(state.name)
}

interface EmitMeta {
  method: ConsoleMethod
  prefix?: string
  prefixColor?: string
  groups: { label: string; color?: string }[]
  levelBadge?: string
}

function emitToConsole(meta: EmitMeta, levelNameForUnknown: string | undefined, args: unknown[]) {
  // Build a `%c`-driven format string with styles array.
  const fmts: string[] = []
  const styles: string[] = []

  // Prefix
  if (meta.prefix) {
    const color = meta.prefixColor ?? getLabelColor(meta.prefix)
    fmts.push(`%c${meta.prefix}`)
    styles.push(cssForLabel(color))
    fmts.push('%c')
    styles.push('')
    fmts.push(' ')
  }

  // Level badge like [I]
  if (meta.levelBadge) {
    fmts.push(`[${meta.levelBadge}]`)
    fmts.push(' ')
  } else if (levelNameForUnknown) {
    fmts.push(`[${levelNameForUnknown}] `)
  }

  // Groups chain: group1 group2 ... each colorized
  for (const g of meta.groups) {
    const color = g.color ?? getLabelColor(g.label)
    fmts.push(`%c${g.label}`)
    styles.push(cssForGroupLabel(color))
    fmts.push('%c')
    styles.push('')
    fmts.push(' ')
  }

  // Join base message and forward extra args untouched
  const method = console[meta.method] ? meta.method : 'log'
  ;(console[method] as any)(fmts.join(''), ...styles, ...args)
}

function cssForLabel(color: string): string {
  return `background: ${color}; color: #fff; font-weight: 700; padding: 1px 2px; border-radius: 4px;`
}

function cssForGroupLabel(color: string): string {
  return `color: ${color}; font-weight: 600; text-decoration: underline;`
}
