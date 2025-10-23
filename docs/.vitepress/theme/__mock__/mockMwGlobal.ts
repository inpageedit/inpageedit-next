export class MockMwMap<T extends Record<string, any> = any> {
  constructor(public values: T = {} as T) {}
  get(): T
  get(key: keyof T): T[keyof T]
  get(key?: keyof T) {
    return key ? this.values[key] : this.values
  }
  set(key: keyof T, value: T[keyof T]) {
    this.values[key] = value
  }
  exists(key: keyof T) {
    return key in this.values
  }
}

export class MockMwHook<T extends any[] = any[]> {
  private static readonly _hookHandlers = new Map<string, MockMwHook<any[]>>()
  static create<T extends any[] = any[]>(name: string) {
    if (this._hookHandlers.has(name)) {
      return this._hookHandlers.get(name)!
    }
    const hook = new MockMwHook<T>(name)
    this._hookHandlers.set(name, hook)
    return hook
  }

  private _handlers: Array<(...data: T) => any> = []

  constructor(public name: string) {}
  add(...handler: Array<(...data: T) => any>): this {
    console.info('hook:', this.name, 'add', handler)
    this._handlers.push(...handler)
    return this
  }
  deprecate(msg: string): this {
    console.info('hook:', this.name, 'deprecate', msg)
    return this
  }
  fire(...data: T): this {
    console.info('hook:', this.name, 'fire', data)
    this._handlers.forEach((handler) => handler(...data))
    return this
  }
  remove(...handler: Array<(...data: T) => any>): this {
    console.info('hook:', this.name, 'remove', handler)
    for (const h of handler) {
      this._handlers = this._handlers.filter((h2) => h2 !== h)
    }
    return this
  }
}
