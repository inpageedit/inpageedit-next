export function makeCallable<C extends object, M extends keyof C>(
  instance: C,
  method: M
): C &
  ((
    ...args: C[M] extends (...a: infer P) => any ? P : never
  ) => C[M] extends (...a: any[]) => infer R ? R : never) {
  const callable: any = (...args: any[]) => {
    const fn = (instance as any)[method]
    if (typeof fn !== 'function') {
      throw new TypeError(`Property "${String(method)}" is not a function`)
    }
    return fn.apply(instance, args)
  }

  const descriptors = Object.getOwnPropertyDescriptors(instance)
  for (const [key, descriptor] of Object.entries(descriptors)) {
    Reflect.defineProperty(callable, key, descriptor)
  }
  Reflect.setPrototypeOf(callable, instance)

  return callable
}
