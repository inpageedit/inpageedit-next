import { InPageEdit, Service } from '@/InPageEdit'
import { createStore, get, set, del, clear, keys, entries, type UseStore } from 'idb-keyval'

declare module '@/InPageEdit' {
  export interface InPageEdit {
    storage: StorageService
  }
}

export class StorageService extends Service {
  constructor(ctx: InPageEdit) {
    super(ctx, 'storage', false)
  }

  createDatabse<T = any>(storeName: string, ttl?: number, version?: number) {
    return new IDBKeyValStorageManager<T>('InPageEdit', storeName, ttl, version)
  }
}

export interface IStorageItem<T = any> {
  /** last update time */
  time: number
  /** stored value */
  value: T
  /** version */
  version?: number
}

export interface IStorageManager<T = unknown> {
  get(key: string, ttl?: number, setter?: () => Promise<any> | any): Promise<T | null>
  set(key: string, value: null | undefined): Promise<void>
  set(key: string, value: T): Promise<IStorageItem<T>>
  has(key: string, ttl?: number): Promise<boolean>
  delete(key: string): Promise<void>
  iterate(callback: (value: T, key: string) => void): Promise<void>
  keys(): Promise<string[]>
  clear(): Promise<this>
}

export interface IStorageManagerConstructor {
  new (dbName: string, storeName: string, ttl?: number, version?: number): IStorageManager<any>
}

export class IDBKeyValStorageManager<T = unknown> implements IStorageManager<T> {
  readonly store: UseStore
  constructor(
    readonly dbName: string,
    readonly storeName: string,
    public ttl: number = Infinity,
    public version?: number
  ) {
    this.store = IDBKeyValStorageManager.createStore(dbName, storeName)
  }

  private static _cached_stores: Map<string, UseStore> = new Map()
  private static createStore(dbName: string, storeName: string) {
    const key = `${dbName}:${storeName}`
    if (this._cached_stores.has(key)) {
      return this._cached_stores.get(key)!
    }
    const store = createStore(dbName, storeName)
    this._cached_stores.set(key, store)
    return store
  }

  async keys(): Promise<string[]> {
    const ks = await keys(this.store)
    return ks.map((k) => String(k))
  }

  async get(key: string, ttl = this.ttl, setter?: () => Promise<T> | T): Promise<T | null> {
    const data = await this.loadFromDB(key)
    const isExpired = this.checkIfExpired(data, ttl)
    if (!data || isExpired) {
      if (typeof setter === 'function') {
        const newData = await setter()
        await this.set(key, newData as T)
        return newData as T
      }
      return null
    }
    return data.value
  }

  set(key: string, value: null | undefined): Promise<void>
  set(key: string, value: T): Promise<IStorageItem<T>>
  async set(key: string, value: T | null | undefined): Promise<IStorageItem<T> | void> {
    if (value === null || typeof value === 'undefined') {
      return this.delete(key)
    }
    const record: IStorageItem<T> = {
      time: Date.now(),
      value,
      version: this.version,
    }
    await set(key, record, this.store)
    return record
  }

  async has(key: string, ttl = this.ttl): Promise<boolean> {
    const data = await this.loadFromDB(key)
    const isExpired = this.checkIfExpired(data, ttl)
    return data !== null && !isExpired
  }

  async delete(key: string): Promise<void> {
    await del(key, this.store)
  }

  async iterate(callback: (value: T, key: string) => void): Promise<void> {
    const all = await entries(this.store)
    for (const [k, v] of all) {
      const key = String(k)
      const data = v as IStorageItem<T> | null
      if (data && typeof (data as any).value !== 'undefined') {
        callback((data as IStorageItem<T>).value, key)
      }
    }
  }

  private async loadFromDB(key: string) {
    const data = await get<{ time: number; value: T; version?: number } | null>(key, this.store)
    // Not exist
    if (!data) {
      return null
    }
    // Bad data
    if (typeof (data as any).time !== 'number' || typeof (data as any).value === 'undefined') {
      try {
        await this.delete(key)
      } catch (_) {}
      return null
    }
    // Version mismatch
    if (typeof this.version === 'number' && (data as any).version !== this.version) {
      try {
        await this.delete(key)
      } catch (_) {}
      return null
    }
    return data as IStorageItem<T>
  }

  private checkIfExpired(data: IStorageItem<T> | null, ttl = this.ttl) {
    if (!data) return false
    return Date.now() - data.time > ttl
  }

  /**
   * [DANGER] Use with caution!
   * Delete all data from the database.
   */
  async clear() {
    await clear(this.store)
    return this
  }
}
