export type ComputeAble<T> = (() => T | Promise<T>) | T
const isFunction = (value: any): value is Function => typeof value === 'function'
export async function computeFallback<T>(value: ComputeAble<T>): Promise<T> {
  if (isFunction(value)) {
    return await value()
  } else {
    return value
  }
}
