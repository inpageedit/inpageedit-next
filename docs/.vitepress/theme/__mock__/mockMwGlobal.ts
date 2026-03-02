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
  private static readonly _hookRegistry = new Map<string, MockMwHook<any[]>>()
  constructor(private readonly name: string) {
    if (MockMwHook._hookRegistry.has(name)) {
      return MockMwHook._hookRegistry.get(name)! as MockMwHook<T>
    }
    MockMwHook._hookRegistry.set(name, this)
  }
  /** @deprecated Use constructor instead */
  static create<T extends any[] = any[]>(name: string) {
    return new MockMwHook<T>(name)
  }

  private _handlers: Array<(...data: T) => any> = []
  private _lastFiredContext: T | undefined = undefined

  add(...handler: Array<(...data: T) => any>): this {
    console.info('hook:', this.name, 'add', handler)
    this._handlers.push(...handler)
    if (this._lastFiredContext) {
      handler.forEach((h) => h(...(this._lastFiredContext as unknown as T)))
    }
    return this
  }
  deprecate(msg: string): this {
    console.info('hook:', this.name, 'deprecate', msg)
    return this
  }
  fire(...data: T): this {
    console.info('hook:', this.name, 'fire', data)
    this._handlers.forEach((handler) => handler(...data))
    this._lastFiredContext = data
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
