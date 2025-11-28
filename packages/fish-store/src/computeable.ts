const isFunction = (value: any): value is Function => typeof value === 'function'

export type ComputeAble<T> = (() => T | Promise<T>) | T
export async function computeFallback<T>(value: ComputeAble<T>): Promise<T> {
  if (isFunction(value)) {
    return await value()
  } else {
    return value
  }
}

export type ComputeAbleSync<T> = (() => T) | T
export function computeFallbackSync<T>(value: ComputeAbleSync<T>): T {
  if (isFunction(value)) {
    return value()
  } else {
    return value
  }
}
