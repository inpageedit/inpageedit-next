import { isRef, Ref, toRaw } from 'vue'

export function deepToRaw<T extends unknown = any>(v: T | Ref<T>): T {
  // 解包 ref
  if (isRef(v)) return deepToRaw(v.value)
  // 基础类型直接返回
  if (v === null || typeof v !== 'object') return v
  // 数组
  if (Array.isArray(v)) return v.map(deepToRaw) as T
  // 普通对象 / reactive 对象（仅当前层 toRaw，再递归）
  const raw = toRaw(v) as Record<string, any>
  const out: Record<string, any> = {}
  for (const k in raw) {
    out[k] = deepToRaw(raw[k])
  }
  return out as T
}
