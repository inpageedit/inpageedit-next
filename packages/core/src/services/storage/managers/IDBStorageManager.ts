import { IDBPlus } from 'idb-plus'
import { AbstractIPEStorageManager, TypedStorageEntry } from '../index.js'

export class IDBStorageManager<T = unknown> implements AbstractIPEStorageManager<T> {
  readonly db: IDBPlus<string, TypedStorageEntry<T>>
  keys: () => AsyncIterable<string>
  values: () => AsyncIterable<TypedStorageEntry<T>>
  entries: () => AsyncIterable<[string, TypedStorageEntry<T>]>

  constructor(
    readonly dbName: string,
    readonly storeName: string,
    public ttl: number = Infinity,
    public version?: number | string
  ) {
    this.db = new IDBPlus<string, TypedStorageEntry<T>>(dbName, storeName)
    this.keys = this.db.keys.bind(this.db)
    this.values = this.db.values.bind(this.db)
    this.entries = this.db.entries.bind(this.db)
    if (typeof this.ttl !== 'number') {
      this.ttl = Number(this.ttl)
    }
    if (isNaN(this.ttl) || this.ttl <= 0) {
      this.ttl = Infinity
    }
    this._clearExpiredEntries().catch(() => {})
  }

  private async _clearExpiredEntries() {
    if (this.ttl === Infinity) return
    const now = Date.now()
    const toDelete: string[] = []
    for await (const [key, entry] of this.db.entries()) {
      if (typeof entry.time === 'number' && now - entry.time > this.ttl) {
        toDelete.push(key)
      }
    }
    if (toDelete.length > 0) {
      await this.db.deleteMany(toDelete)
    }
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
  set(key: string, value: T): Promise<TypedStorageEntry<T>>
  set(
    record: Record<string, T | null | undefined>
  ): Promise<Record<string, TypedStorageEntry<T> | void>>
  async set(
    keyOrRecord: string | Record<string, T | null | undefined>,
    maybeValue?: T | null | undefined
  ): Promise<TypedStorageEntry<T> | void | Record<string, TypedStorageEntry<T> | void>> {
    const now = Date.now()

    // Overload 1: set(key, value)
    if (typeof keyOrRecord === 'string') {
      const key = keyOrRecord
      const value = maybeValue as T | null | undefined
      if (value === null || typeof value === 'undefined') {
        return this.delete(key)
      }
      const record: TypedStorageEntry<T> = {
        time: now,
        value,
        version: this.version,
      }
      await this.db.set(key, record)
      return record
    }

    // Overload 2: set(record)
    const recordObject = keyOrRecord as Record<string, T | null | undefined>
    const toSet: Array<[string, TypedStorageEntry<T>]> = []
    const toDelete: Array<string> = []
    const results: Record<string, TypedStorageEntry<T> | void> = {}

    for (const [key, value] of Object.entries(recordObject)) {
      if (value === null || typeof value === 'undefined') {
        toDelete.push(key)
      } else {
        const rec: TypedStorageEntry<T> = { time: now, value: value as T, version: this.version }
        toSet.push([key, rec])
        results[key] = rec
      }
    }

    if (toSet.length > 0) {
      await this.db.setMany(toSet)
    }
    if (toDelete.length > 0) {
      await this.db.deleteMany(toDelete)
    }
    return results
  }

  async has(key: string, ttl = this.ttl): Promise<boolean> {
    const data = await this.loadFromDB(key)
    const isExpired = this.checkIfExpired(data, ttl)
    return data !== null && !isExpired
  }

  async delete(key: string): Promise<void> {
    await this.db.delete(key)
  }

  async updatedAt(key: string): Promise<number> {
    const data = await this.loadFromDB(key)
    return data ? data.time : 0
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
    if (
      typeof this.version !== 'undefined' &&
      typeof this.version !== 'undefined' &&
      data.version !== this.version
    ) {
      try {
        await this.delete(key)
      } catch (_) {}
      return null
    }
    return data
  }

  private checkIfExpired(data: TypedStorageEntry<T> | null, ttl = this.ttl) {
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
