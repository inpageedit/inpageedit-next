import { isRef, Ref, toRaw } from 'vue'


export function deepToRaw<T extends unknown = any>(v: T | Ref<T>, seen = new WeakMap()): T {
  // 处理 ref
  if (isRef(v)) {
    return deepToRaw(v.value, seen)
  }

  // 基础类型
  if (v === null || typeof v !== 'object') {
    return v
  }

  // 检查循环引用
  if (seen.has(v)) {
    return seen.get(v)
  }

  // 特殊内置对象
  if (v instanceof Date) {
    return new Date(v) as T
  }
  if (v instanceof RegExp) {
    return new RegExp(v) as T
  }
  if (v instanceof Map) {
    const cloned = new Map()
    seen.set(v, cloned)
    Array.from(v.entries()).forEach(([key, value]) => {
      cloned.set(key, deepToRaw(value, seen))
    })
    return cloned as T
  }
  if (v instanceof Set) {
    const cloned = new Set()
    seen.set(v, cloned)
    Array.from(v).forEach((value) => {
      cloned.add(deepToRaw(value, seen))
    })
    return cloned as T
  }

  // 数组
  if (Array.isArray(v)) {
    const result: any[] = []
    seen.set(v, result)
    for (const item of v) {
      result.push(deepToRaw(item, seen))
    }
    return result as T
  }

  // 普通对象 / reactive 对象
  const raw = toRaw(v) as Record<string | symbol, any>
  const out: Record<string | symbol, any> = {}
  seen.set(v, out)

  // 字符串键
  for (const k of Object.keys(raw)) {
    out[k] = deepToRaw(raw[k], seen)
  }

  // Symbol 键（可选）
  for (const k of Object.getOwnPropertySymbols(raw)) {
    out[k] = deepToRaw(raw[k], seen)
  }

  return out as T
}
