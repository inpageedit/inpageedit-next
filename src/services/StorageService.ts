import { InPageEdit, Service } from '@/InPageEdit'
import localforage from 'localforage'

declare module '@/InPageEdit' {
  export interface InPageEdit {
    storage: StorageService
    localforage: typeof localforage
  }
}

export class StorageService extends Service {
  constructor(ctx: InPageEdit) {
    super(ctx, 'storage', false)
    ctx.set('localforage', localforage)
  }
  get StorageManager() {
    return StorageManager
  }

  createDatabse<T = any>(storeName: string, ttl?: number) {
    return new StorageManager<T>('InPageEdit', storeName, ttl)
  }
}

export interface StorageManagerItem<T = any> {
  time: number
  value: T
}

export class StorageManager<T = any> {
  static DEFAULT_TTL = Infinity
  static readonly _cached_db_instances: Map<string, LocalForage> = new Map()

  readonly db: LocalForage

  /**
   *
   * @param dbName
   * @param storeName
   * @param ttl
   */
  constructor(
    readonly dbName: string,
    readonly storeName: string,
    public ttl: number = StorageManager.DEFAULT_TTL
  ) {
    this.db = StorageManager.createDatabase(dbName, storeName)
  }

  static createDatabase(dbName: string, storeName: string) {
    const key = `${dbName}:${storeName}`
    if (this._cached_db_instances.has(key)) {
      return this._cached_db_instances.get(key)!
    }
    const db = localforage.createInstance({
      name: dbName,
      storeName,
    })
    this._cached_db_instances.set(key, db)
    return db
  }

  async get(
    key: string,
    ttl = this.ttl,
    setter?: () => Promise<NonNullable<T>> | NonNullable<T>
  ): Promise<T | null> {
    const data = await this.loadFromDB(key)
    const isExpired = this.checkIfExpired(data, ttl)
    if (!data || isExpired) {
      if (typeof setter === 'function') {
        const newData = await setter()
        return this.set(key, newData).then(() => {
          return newData
        })
      }
      return null
    }
    return data.value
  }

  async set(key: string, value: T): Promise<StorageManagerItem<T>> {
    return this.db.setItem(key, {
      time: Date.now(),
      value,
    })
  }

  async has(key: string, ttl = this.ttl): Promise<boolean> {
    const data = await this.loadFromDB(key)
    const isExpired = this.checkIfExpired(data, ttl)
    return data !== null && !isExpired
  }

  async delete(key: string): Promise<void> {
    return this.db.removeItem(key)
  }

  async loadFromDB(key: string) {
    const data = await this.db.getItem<{ time: number; value: T }>(key)
    // Not exist
    if (!data) {
      return null
    }
    // Bad data
    if (typeof data.time !== 'number' || typeof data.value === 'undefined') {
      try {
        this.delete(key)
      } catch (e) {}
      return null
    }
    return data
  }

  checkIfExpired(data: StorageManagerItem<T> | null, ttl = this.ttl) {
    if (!data) {
      return false
    }
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
