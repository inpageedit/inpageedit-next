// keyword & RegExp caches
const ESCAPE_ARG_L = '\uF114'
const ESCAPE_ARG_R = '\uF514'
const REG_ESCAPE_ARG_L = /\\\{/g
const REG_ESCAPE_ARG_R = /\\\}/g
const REG_RESTORE_ARG_L = new RegExp(ESCAPE_ARG_L, 'g')
const REG_RESTORE_ARG_R = new RegExp(ESCAPE_ARG_R, 'g')

/**
 * interpolate
 *  - 具名插值：`{{expr}}`，其中 expr 可为标识符或简单表达式（如 `{{ name || "world" }}`、`{{ name ? 'hi ' + name : '' }}`）。
 *  - 匿名插值：使用 `{{ $1 }}`、`{{ $2 }}`...，可用可变参数或数组提供位置参数。
 *  - 具名与匿名可混用；若缺失值，替换为空字符串。
 *
 * 示例：
 * ```ts
 *  interpolate('hello, {{ name }}') // 'hello, '
 *  interpolate('hello, {{ name || "world" }}') // 'hello, world'
 *  interpolate('hello, {{ name || "world" }}', { name: 'dragon' }) // 'hello, dragon'
 *  interpolate('hello, {{ $1 }}. {{ $2 }}', 'dragon', 'yeah') // 'hello, dragon. yeah'
 *  interpolate('hello, {{ $1 }}. {{ $2 }}', ['dragon', 'yeah']) // 'hello, dragon. yeah'
 *  interpolate('hello, {{ $1 }}. {{ greeting || "" }}', { $1: 'dragon', greeting: 'yeah' }) // 'hello, dragon. yeah'
 * ```
 */
export function interpolate(template: string): string
export function interpolate(template: string, context: Record<string, unknown>): string
export function interpolate(template: string, ...numricContext: string[]): string
export function interpolate(template: string, numricContext: string[]): string
export function interpolate(template: string, ...args: Array<unknown>): string {
  if (!template) return ''

  let out = String(template)
    .replace(REG_ESCAPE_ARG_L, ESCAPE_ARG_L)
    .replace(REG_ESCAPE_ARG_R, ESCAPE_ARG_R)

  let named: Record<string, unknown> = {}
  let numrics: unknown[] = []

  if (args.length === 1 && Array.isArray(args[0])) {
    numrics = args[0] as unknown[]
  } else if (args.length === 1 && isPlainObject(args[0])) {
    named = args[0] as Record<string, unknown>
  } else if (args.length > 0) {
    numrics = args
  }

  const ctx: Record<string, unknown> = Object.create(null)
  if (numrics && numrics.length) {
    for (let i = 0; i < numrics.length; i++) {
      ctx[`$${i + 1}`] = numrics[i]
    }
  }
  if (named && Object.keys(named).length) {
    for (const k of Object.keys(named)) ctx[k] = (named as any)[k]
  }

  out = out.replace(/\{\{\s*([\s\S]*?)\s*\}\}/g, (_m, exprRaw: string) => {
    const expr = String(exprRaw).trim()
    if (!expr) return ''
    try {
      const value = safeEval(expr, ctx)
      if (value == null) return ''
      return String(value)
    } catch {
      return ''
    }
  })

  return out.replace(REG_RESTORE_ARG_L, '{').replace(REG_RESTORE_ARG_R, '}')
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && (v as object).constructor === Object
}

const safeEval = createEvaluator()
function createEvaluator() {
  const globalNames = new Set([
    'eval',
    'Object',
    'Array',
    'String',
    'Number',
    'Boolean',
    'Date',
    'Math',
    'JSON',
    'undefined',
    'null',
    'true',
    'false',
    'NaN',
    'Infinity',
    'isNaN',
    'isFinite',
    'parseInt',
    'parseFloat',
  ])

  const fn = new Function(
    '__expr__',
    'ctx',
    `
    try {
      with (ctx) {
        return (eval(__expr__));
      }
    } catch (e) {
      throw e;
    }
  `
  ) as (expr: string, ctx: Record<string, unknown>) => unknown
  return (expr: string, ctx: Record<string, unknown>) => {
    /**
     * 创建 ctx 的代理，避免模板字符串调用了未传递的参数
     * 例如：interpolate('hello, {{ name || "world" }}')
     * 我们没有传递任何参数，引用 name 会出现 ReferenceError
     */
    const proxiedCtx = new Proxy(ctx, {
      has: (target, prop) => {
        if (typeof prop === 'symbol') {
          return prop in target
        }
        if (typeof prop === 'string' && (globalNames.has(prop) || prop === '__expr__')) {
          return false
        }
        return true
      },
      get: (target, prop) => {
        if (prop in target) {
          return target[prop as string]
        }
        return undefined
      },
    })
    return fn(expr, proxiedCtx)
  }
}
