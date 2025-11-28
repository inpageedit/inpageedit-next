import { IDBPlus } from 'idb-plus'
import { IFishStorageManager, IFishStorageEntry } from '../types.js'

export class IDBStorageManager<T = unknown> implements IFishStorageManager<T> {
  readonly db: IDBPlus<string, IFishStorageEntry<T>>
  keys: () => AsyncIterable<string>
  values: () => AsyncIterable<IFishStorageEntry<T>>
  entries: () => AsyncIterable<[string, IFishStorageEntry<T>]>

  constructor(
    readonly dbName: string,
    readonly storeName: string,
    public ttl: number = Infinity,
    public version?: number | string
  ) {
    this.db = new IDBPlus<string, IFishStorageEntry<T>>(dbName, storeName)
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
  async getMany(
    keys: string[],
    ttl?: number
  ): Promise<Record<string, IFishStorageEntry<T> | null>> {
    const result: Record<string, IFishStorageEntry<T> | null> = {}
    for (const key of keys) {
      const data = await this.getRaw(key)
      const isExpired = this.checkIfExpired(data, ttl)
      result[key] = data && !isExpired ? data : null
    }
    return result
  }

  async setMany(
    record: Record<string, T | null | undefined>
  ): Promise<Record<string, void | IFishStorageEntry<T>>> {
    return await this.set(record)
  }

  async deleteMany(keys: string[]): Promise<number> {
    const count = await this.db.deleteMany(keys)
    return count
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
    const data = await this.getRaw(key)
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
  set(key: string, value: T): Promise<IFishStorageEntry<T>>
  set(
    record: Record<string, T | null | undefined>
  ): Promise<Record<string, IFishStorageEntry<T> | void>>
  async set(
    keyOrRecord: string | Record<string, T | null | undefined>,
    maybeValue?: T | null | undefined
  ): Promise<IFishStorageEntry<T> | void | Record<string, IFishStorageEntry<T> | void>> {
    const now = Date.now()

    // Overload 1: set(key, value)
    if (typeof keyOrRecord === 'string') {
      const key = keyOrRecord
      const value = maybeValue as T | null | undefined
      if (value === null || typeof value === 'undefined') {
        return this.delete(key)
      }
      const record: IFishStorageEntry<T> = {
        time: now,
        value,
        version: this.version,
      }
      await this.db.set(key, record)
      return record
    }

    // Overload 2: set(record)
    const recordObject = keyOrRecord as Record<string, T | null | undefined>
    const toSet: Array<[string, IFishStorageEntry<T>]> = []
    const toDelete: Array<string> = []
    const results: Record<string, IFishStorageEntry<T> | void> = {}

    for (const [key, value] of Object.entries(recordObject)) {
      if (value === null || typeof value === 'undefined') {
        toDelete.push(key)
      } else {
        const rec: IFishStorageEntry<T> = { time: now, value: value as T, version: this.version }
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
    const data = await this.getRaw(key)
    const isExpired = this.checkIfExpired(data, ttl)
    return data !== null && !isExpired
  }

  async delete(key: string): Promise<void> {
    await this.db.delete(key)
  }

  async updatedAt(key: string): Promise<number> {
    const data = await this.getRaw(key)
    return data ? data.time : 0
  }

  async getRaw(key: string) {
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

  private checkIfExpired(data: IFishStorageEntry<T> | null, ttl = this.ttl) {
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
