export const CALLABLE_APPLY_SYMBOL = Symbol('@@apply')
export const CALLABLE_CTOR_SYMBOL = Symbol('@@ctor')
export function makeCallable<C extends object, M extends keyof C>(
  instance: C,
  method: M
): C &
  ((
    ...args: C[M] extends (...a: infer P) => any ? P : never
  ) => C[M] extends (...a: any[]) => infer R ? R : never) {
  if (typeof instance !== 'object' || instance === null || Array.isArray(instance)) {
    throw new TypeError('instance is not an object')
  }

  const apply: any = (...args: any[]) => {
    const fn = (instance as any)[method]
    if (typeof fn !== 'function') {
      throw new TypeError(`Property "${String(method)}" is not a function`)
    }
    return fn.apply(instance, args)
  }
  apply[CALLABLE_APPLY_SYMBOL] = apply
  apply[CALLABLE_CTOR_SYMBOL] = instance

  const ctorName = (instance as any)?.constructor?.name
  if (ctorName) (apply as any)[Symbol.toStringTag] = ctorName

  const proxy = new Proxy(apply, {
    get(_, p, receiver) {
      if (p === 'prototype') return Reflect.get(apply, p, receiver)
      return Reflect.get(instance as any, p, instance)
    },
    set(_, p, v) {
      return Reflect.set(instance as any, p, v)
    },
    has(_, p) {
      return Reflect.has(instance as any, p)
    },
    deleteProperty(_, p) {
      return Reflect.deleteProperty(instance as any, p)
    },
    ownKeys() {
      return Reflect.ownKeys(instance as any)
    },
    getOwnPropertyDescriptor(_, p) {
      return Object.getOwnPropertyDescriptor(instance as any, p)
    },
    defineProperty(_, p, desc) {
      return Object.defineProperty(instance as any, p, desc)
    },
  })

  return proxy as unknown as any
}
