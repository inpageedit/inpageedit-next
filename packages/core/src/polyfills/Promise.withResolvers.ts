export const promiseWithResolvers = <T extends unknown = any>() => {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: any) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

if (!Promise.withResolvers) {
  Promise.withResolvers = promiseWithResolvers
}
