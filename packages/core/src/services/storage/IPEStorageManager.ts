import { IDBPlus } from 'idb-plus'
import { AbstractIPEStorageManager, IPEStorageRecord } from './index.js'

export class IPEStorageManager<T = unknown> implements AbstractIPEStorageManager<T> {
  readonly db: IDBPlus<string, IPEStorageRecord<T>>
  keys: () => AsyncIterable<string>
  values: () => AsyncIterable<IPEStorageRecord<T>>
  entries: () => AsyncIterable<[string, IPEStorageRecord<T>]>

  constructor(
    readonly dbName: string,
    readonly storeName: string,
    public ttl: number = Infinity,
    public version?: number
  ) {
    this.db = new IDBPlus<string, IPEStorageRecord<T>>(dbName, storeName)
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
