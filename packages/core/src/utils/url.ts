/**
 * Transform a plain object into a URL search params string.
 *
 * @example
 * ```
 * makeURLSearchParams({ str: '123' }) // str=123
 * makeURLSearchParams({ num: 123 }) // num=123
 * makeURLSearchParams({ bool: true }) // bool=true
 * makeURLSearchParams({ arr: [1, 2, 3] }) // arr=1&arr=2&arr=3
 * makeURLSearchParams({ plainObj: { a: 1, b: 2 } }) // plainObj[a]=1&plainObj[b]=2
 * makeURLSearchParams({ obj: <object> }) // obj=<object>.toString() (if object is not a primitive type)
 * makeURLSearchParams({ empty: '' }) // empty=
 * makeURLSearchParams({ null: null, undefined: undefined }) // (ignored)
 * ```
 */
export const makeSearchParams = (params?: Record<string, any>): URLSearchParams => {
  if (!params) {
    return new URLSearchParams()
  }
  if (params instanceof URLSearchParams) {
    return params
  }
  if (typeof params !== 'object' || params?.constructor !== Object) {
    throw new TypeError('only plain object is supported')
  }

  const sp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === void 0 || value === null) {
      continue
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        sp.append(key, item?.toString())
      }
      continue
    }
    if (typeof value === 'object' && value !== null && value.constructor === Object) {
      for (const [objKey, objValue] of Object.entries(value)) {
        if (objValue !== void 0 && objValue !== null) {
          sp.set(`${key}[${objKey}]`, objValue?.toString())
        }
      }
      continue
    }
    sp.set(key, value?.toString())
  }
  return sp
}

/**
 * Create a URL object with the given parameters.
 *
 * @example
 * ```
 * makeURL('https://example.com?existing=1', { foo: 'bar' }, 'baz') // https://example.com?existing=1&foo=bar#baz
 */
export const makeURL = (url: string | URL, params?: Record<string, any>, hash?: string): URL => {
  const u = typeof url === 'string' ? new URL(url, window?.location?.origin) : new URL(url)

  const existingParams = new URLSearchParams(u.search)
  const newParams = makeSearchParams(params)
  for (const [key, value] of newParams.entries()) {
    existingParams.set(key, value)
  }

  u.search = existingParams.toString()
  u.hash = hash || ''
  return u
}
