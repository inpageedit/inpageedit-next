import { AbstractIPEStorageManager, TypedStorageEntry } from '../index.js'
import { MemoryStorage, useMemoryStorage } from '@/models/MemoryStorage.js'

const _memoryStorage = (() => {
  const sym = Symbol.for('IPE.GlobalMemoryStorage')
  if (!(sym in globalThis)) {
    ;(globalThis as any)[sym] = useMemoryStorage()
  }
  return (globalThis as any)[sym] as MemoryStorage
})()

export class LocalStorageManager<T = unknown> implements AbstractIPEStorageManager<T> {
  private db: Storage
  constructor(
    public dbName?: string,
    readonly storeName?: string,
    public ttl: number = Infinity,
    public version?: number | string,
    public engine: 'localStorage' | 'sessionStorage' | 'memory' = 'localStorage'
  ) {
    // Normalize ttl
    if (typeof ttl !== 'number') this.ttl = Number(ttl)
    if (isNaN(this.ttl) || this.ttl <= 0) this.ttl = Infinity

    // Initialize storage engine
    if (this.engine === 'localStorage' && 'localStorage' in window) {
      this.db = window.localStorage
    } else if (this.engine === 'sessionStorage' && 'sessionStorage' in window) {
      this.db = window.sessionStorage
    } else {
      this.db = _memoryStorage
    }
  }

  // Key builder
  private makeKey(key: string) {
    return `${this.dbName ? this.dbName + ':' : ''}${this.storeName ? this.storeName + '/' : ''}${key}`
  }

  // Internal load & validation
  private load(key: string): TypedStorageEntry<T> | null {
    const raw = this.getRaw(key)
    if (raw === null) return null
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (_) {
      this.deleteSync(key)
      return null
    }
    const rec = parsed as Partial<TypedStorageEntry<T>>
    // Structural checks
    if (typeof rec.time !== 'number' || !('value' in rec)) {
      this.deleteSync(key)
      return null
    }
    // Version check
    if (
      typeof this.version !== 'undefined' &&
      typeof this.version !== 'undefined' &&
      rec.version !== this.version
    ) {
      this.deleteSync(key)
      return null
    }
    return rec as TypedStorageEntry<T>
  }

  private getRaw(key: string): string | null {
    const fullKey = this.makeKey(key)
    return this.db.getItem(fullKey)
  }

  private setRaw(key: string, value: string) {
    const fullKey = this.makeKey(key)
    try {
      this.db.setItem(fullKey, value)
    } catch (_) {
      // Quota exceeded or write error — silently ignore for now.
    }
  }

  private deleteSync(key: string) {
    const fullKey = this.makeKey(key)
    this.db.removeItem(fullKey)
  }

  private isExpired(rec: TypedStorageEntry<T> | null, ttl = this.ttl) {
    if (!rec) return false
    return Date.now() - rec.time > ttl
  }

  async get(key: string, ttl = this.ttl, setter?: () => Promise<T> | T): Promise<T | null> {
    const rec = this.load(key)
    const expired = this.isExpired(rec, ttl)
    if (!rec || expired) {
      if (typeof setter === 'function') {
        const newValue = await setter()
        await this.set(key, newValue as T)
        return newValue as T
      }
      return null
    }
    return rec.value
  }

  // Overloads
  async set(key: string, value: null | undefined): Promise<void>
  async set(key: string, value: T): Promise<TypedStorageEntry<T>>
  async set(
    record: Record<string, T | null | undefined>
  ): Promise<Record<string, TypedStorageEntry<T> | void>>
  async set(
    keyOrRecord: string | Record<string, T | null | undefined>,
    maybeValue?: T | null | undefined
  ): Promise<TypedStorageEntry<T> | void | Record<string, TypedStorageEntry<T> | void>> {
    const now = Date.now()

    if (typeof keyOrRecord === 'string') {
      const key = keyOrRecord
      const value = maybeValue as T | null | undefined
      if (value === null || typeof value === 'undefined') {
        await this.delete(key)
        return
      }
      const rec: TypedStorageEntry<T> = { time: now, value, version: this.version }
      this.setRaw(key, JSON.stringify(rec))
      return rec
    }

    const recordObj = keyOrRecord as Record<string, T | null | undefined>
    const results: Record<string, TypedStorageEntry<T> | void> = {}
    for (const [k, v] of Object.entries(recordObj)) {
      if (v === null || typeof v === 'undefined') {
        this.deleteSync(k)
        continue
      }
      const rec: TypedStorageEntry<T> = { time: now, value: v as T, version: this.version }
      this.setRaw(k, JSON.stringify(rec))
      results[k] = rec
    }
    return results
  }

  async has(key: string, ttl = this.ttl): Promise<boolean> {
    const rec = this.load(key)
    return rec !== null && !this.isExpired(rec, ttl)
  }

  async delete(key: string): Promise<void> {
    this.deleteSync(key)
  }

  async updatedAt(key: string): Promise<number> {
    const rec = this.load(key)
    return rec ? rec.time : 0
  }

  async clear(): Promise<this> {
    // Remove only keys with our prefix+storeName
    const prefix = this.makeKey('')
    // Collect first to avoid index shifting issues
    const toRemove: string[] = []
    for (let i = 0; i < this.db.length; i++) {
      const k = this.db.key(i)
      if (k && k.startsWith(prefix)) toRemove.push(k)
    }
    for (const k of toRemove) this.db.removeItem(k)
    return this
  }

  // Async generators
  async *keys(): AsyncIterable<string> {
    const prefix = this.makeKey('')
    for (let i = 0; i < this.db.length; i++) {
      const k = this.db.key(i)
      if (k && k.startsWith(prefix)) yield k.slice(prefix.length)
    }
  }

  async *values(): AsyncIterable<TypedStorageEntry<T>> {
    for await (const k of this.keys()) {
      const rec = this.load(k)
      if (!rec) continue
      if (this.isExpired(rec)) {
        this.deleteSync(k)
        continue
      }
      yield rec
    }
  }

  async *entries(): AsyncIterable<[string, TypedStorageEntry<T>]> {
    for await (const k of this.keys()) {
      const rec = this.load(k)
      if (!rec) continue
      if (this.isExpired(rec)) {
        this.deleteSync(k)
        continue
      }
      yield [k, rec]
    }
  }
}
