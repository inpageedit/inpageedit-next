import { InPageEdit, Service } from '@/InPageEdit.js'
import { IDBStoreHandle, IDBHelper, IDBStorage } from './IDBStorage.js'

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
  keys(): AsyncIterable<string>
  values(): AsyncIterable<IPEStorageRecord<T>>
  entries(): AsyncIterable<[string, IPEStorageRecord<T>]>
  clear(): Promise<this>
}

export class IDBStorageManager<T = unknown> implements AbstactIPEStorageManager<T> {
  readonly db: IDBStorage<string, IPEStorageRecord<T>>
  keys: () => AsyncIterable<string>
  values: () => AsyncIterable<IPEStorageRecord<T>>
  entries: () => AsyncIterable<[string, IPEStorageRecord<T>]>

  constructor(
    readonly dbName: string,
    readonly storeName: string,
    public ttl: number = Infinity,
    public version?: number
  ) {
    this.db = new IDBStorage<string, IPEStorageRecord<T>>(dbName, storeName)
    this.keys = this.db.keys.bind(this.db)
    this.values = this.db.values.bind(this.db)
    this.entries = this.db.entries.bind(this.db)
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
    await this.db.set(key, record)
    return record
  }

  async has(key: string, ttl = this.ttl): Promise<boolean> {
    const data = await this.loadFromDB(key)
    const isExpired = this.checkIfExpired(data, ttl)
    return data !== null && !isExpired
  }

  async delete(key: string): Promise<void> {
    await this.db.delete(key)
  }

  private async loadFromDB(key: string) {
    const data = await this.db.get(key)
    // Not exist
    if (data === void 0) {
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
    await this.db.clear()
    return this
  }
}
