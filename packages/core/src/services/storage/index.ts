import { InPageEdit, Service } from '@/InPageEdit.js'
import { IDBStoreDefinition, IDBHelper } from './IDBStorage.js'

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
    return new IDBStorageManager<T>('InPageEdit', storeName, ttl, version)
  }
}

export interface IPEStorageRecord<T = any> {
  /** last update time */
  time: number
  /** stored value */
  value: T
  /** version */
  version?: number
}

export interface AbstactIPEStorageManager<T = unknown> {
  get(key: string, ttl?: number, setter?: () => Promise<any> | any): Promise<T | null>
  set(key: string, value: null | undefined): Promise<void>
  set(key: string, value: T): Promise<IPEStorageRecord<T>>
  has(key: string, ttl?: number): Promise<boolean>
  delete(key: string): Promise<void>
  iterate(callback: (value: T, key: string) => void): Promise<void>
  keys(): Promise<string[]>
  clear(): Promise<this>
}

export class IDBStorageManager<T = unknown> implements AbstactIPEStorageManager<T> {
  readonly store: IDBStoreDefinition
  constructor(
    readonly dbName: string,
    readonly storeName: string,
    public ttl: number = Infinity,
    public version?: number
  ) {
    this.store = IDBStorageManager.createStore(dbName, storeName)
    IDBHelper.set(this.store, '_touched', Date.now())
  }

  private static _cached_stores: Map<string, IDBStoreDefinition> = new Map()
  private static createStore(dbName: string, storeName: string) {
    const key = `${dbName}:${storeName}`
    if (this._cached_stores.has(key)) {
      return this._cached_stores.get(key)!
    }
    const dbPromise = IDBHelper.createStore(dbName, storeName)
    const store: IDBStoreDefinition = { dbName, storeName, dbPromise }
    this._cached_stores.set(key, store)
    return store
  }

  async keys(): Promise<string[]> {
    const ks = await IDBHelper.keys(this.store)
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
  set(key: string, value: T): Promise<IPEStorageRecord<T>>
  async set(key: string, value: T | null | undefined): Promise<IPEStorageRecord<T> | void> {
    if (value === null || typeof value === 'undefined') {
      return this.delete(key)
    }
    const record: IPEStorageRecord<T> = {
      time: Date.now(),
      value,
      version: this.version,
    }
    await IDBHelper.set(this.store, key, record)
    return record
  }

  async has(key: string, ttl = this.ttl): Promise<boolean> {
    const data = await this.loadFromDB(key)
    const isExpired = this.checkIfExpired(data, ttl)
    return data !== null && !isExpired
  }

  async delete(key: string): Promise<void> {
    await IDBHelper.del(this.store, key)
  }

  async iterate(callback: (value: T, key: string) => void): Promise<void> {
    const all = await IDBHelper.entries(this.store)
    for (const [k, v] of all) {
      const key = String(k)
      const data = v as IPEStorageRecord<T> | null
      if (data && typeof (data as any).value !== 'undefined') {
        callback((data as IPEStorageRecord<T>).value, key)
      }
    }
  }

  private async loadFromDB(key: string) {
    const data = await IDBHelper.get<IPEStorageRecord<T>>(this.store, key)
    // Not exist
    if (!data) {
      return null
    }
    // Bad data
    if (typeof data.time !== 'number' || typeof data.value === 'undefined') {
      try {
        await this.delete(key)
      } catch (_) {}
      return null
    }
    // Version mismatch
    if (typeof this.version === 'number' && data.version !== this.version) {
      try {
        await this.delete(key)
      } catch (_) {}
      return null
    }
    return data
  }

  private checkIfExpired(data: IPEStorageRecord<T> | null, ttl = this.ttl) {
    if (!data) return false
    return Date.now() - data.time > ttl
  }

  /**
   * [DANGER] Use with caution!
   * Delete all data from the database.
   */
  async clear() {
    await IDBHelper.clear(this.store)
    return this
  }
}
