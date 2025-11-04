import { EnsureStoreOptions, IDBPlusHelper } from './helper.js'

export * from './helper.js'

export interface IDBPlusOptions {
  /**
   * Batch size for async iteration
   * @default 100
   */
  iterBatch?: number
  /** Creation options (see EnsureStoreOptions) */
  ensure?: EnsureStoreOptions
  /**
   * Retry config
   * @default { attempts: 3, baseDelayMs: 16 }
   */
  retry?: { attempts?: number; baseDelayMs?: number }
}

/**
 * IDB Plus
 *
 * 🗄️ Minimal Promise based IndexedDB Wrapper with Map-like API
 *
 * @author dragon-fish <dragon-fish@qq.com>
 * @license MIT
 */
export class IDBPlus<K extends IDBValidKey = IDBValidKey, V = any>
  implements AsyncIterable<[K, V]>
{
  static readonly version = import.meta.env.__VERSION__

  constructor(
    readonly dbName: string,
    readonly storeName: string,
    readonly options: IDBPlusOptions = {}
  ) {}

  private get _iterBatch() {
    return this.options.iterBatch ?? IDBPlusHelper.defaults.iterBatch
  }
  private get _retryCfg() {
    const r = this.options.retry ?? IDBPlusHelper.defaults.retry
    return { attempts: r.attempts ?? 3, baseDelayMs: r.baseDelayMs ?? 16 }
  }

  private async _withStore<T>(
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => Promise<T>
  ): Promise<T> {
    const cfg = this._retryCfg
    return IDBPlusHelper.withRetry<T>(
      cfg,
      async () => {
        const db = await IDBPlusHelper.getDB(this.dbName, this.storeName, this.options.ensure)
        try {
          const tx = db.transaction(this.storeName, mode)
          const store = tx.objectStore(this.storeName)
          const out = await fn(store)
          await IDBPlusHelper.waitTx(tx)
          return out
        } catch (e) {
          // Re-throw to let withRetry decide; tx errors often mean disconnect
          throw e
        }
      },
      async (err) => {
        if (IDBPlusHelper.shouldReconnect(err)) {
          await IDBPlusHelper.closeConnection(this.dbName) // lazy reconnect on next attempt
        }
      }
    )
  }

  async get(key: K): Promise<V | undefined> {
    return this._withStore('readonly', async (s) => {
      const res = await IDBPlusHelper.asyncRequest<any>(s.get(key as IDBValidKey))
      return res === undefined ? undefined : (res as V)
    })
  }

  async set(key: K, value: V): Promise<this> {
    await this._withStore('readwrite', async (s) => {
      const hasKeyPath = this.options.ensure?.keyPath != null
      const req = hasKeyPath ? s.put(value as any) : s.put(value as any, key as IDBValidKey)
      await IDBPlusHelper.asyncRequest(req)
      return
    })
    return this
  }

  async delete(key: K): Promise<boolean> {
    return this._withStore('readwrite', async (s) => {
      // Check existence to return a truthful boolean
      const existed =
        (await IDBPlusHelper.asyncRequest<any>(s.get(key as IDBValidKey))) !== undefined
      await IDBPlusHelper.asyncRequest(s.delete(key as IDBValidKey))
      return existed
    })
  }

  async clear(): Promise<void> {
    await this._withStore('readwrite', async (s) => {
      await IDBPlusHelper.asyncRequest(s.clear())
    })
  }

  async has(key: K): Promise<boolean> {
    const v = await this.get(key)
    return v !== undefined
  }

  async count(): Promise<number> {
    return this._withStore('readonly', async (s) => {
      const n = await IDBPlusHelper.asyncRequest<number>(s.count())
      return n ?? 0
    })
  }

  private async *_iterateEntries(): AsyncIterable<[K, V]> {
    // Restart transaction every N items to avoid long-lived cursors
    let lastKey: IDBValidKey | null = null
    let done = false
    const batch = Math.max(1, this._iterBatch)

    while (!done) {
      const chunk: Array<[K, V]> = await this._withStore('readonly', async (s) => {
        const out: Array<[K, V]> = []
        const range = lastKey === null ? undefined : IDBKeyRange.lowerBound(lastKey, true)
        await new Promise<void>((resolve, reject) => {
          const req = s.openCursor(range)
          req.onerror = () => reject(req.error)
          req.onsuccess = () => {
            const cur = req.result as IDBCursorWithValue | null
            if (!cur) {
              done = true
              resolve()
              return
            }
            out.push([cur.key as K, cur.value as V])
            lastKey = cur.key as IDBValidKey
            if (out.length >= batch) {
              resolve()
            } else {
              cur.continue()
            }
          }
        })
        return out
      })

      for (const item of chunk) yield item
      if (chunk.length === 0) break
    }
  }

  entries(): AsyncIterable<[K, V]> {
    return this._iterateEntries()
  }

  async *keys(): AsyncIterable<K> {
    for await (const [k] of this.entries()) yield k
  }

  async *values(): AsyncIterable<V> {
    for await (const [, v] of this.entries()) yield v
  }

  [Symbol.asyncIterator](): AsyncIterator<[K, V]> {
    return this.entries()[Symbol.asyncIterator]()
  }

  async forEach(
    cb: (value: V, key: K, store: IDBPlus<K, V>) => void | Promise<void>
  ): Promise<void> {
    for await (const [k, v] of this.entries()) {
      await cb(v as V, k as K, this)
    }
  }

  async getMany(keys: Iterable<K> | AsyncIterable<K>): Promise<Map<K, V | undefined>> {
    const out = new Map<K, V | undefined>()
    for await (const k of keys) out.set(k, undefined)
    await this._withStore('readonly', async (s) => {
      await Promise.all(
        out.keys().map(async (k) => {
          const v = await IDBPlusHelper.asyncRequest<any>(s.get(k))
          out.set(k, v === undefined ? undefined : (v as V))
        })
      )
    })
    return out
  }

  async setMany(entries: Iterable<[K, V]> | AsyncIterable<[K, V]>): Promise<this> {
    const hasKeyPath = this.options.ensure?.keyPath != null
    await this._withStore('readwrite', async (s) => {
      for await (const [k, v] of entries as any) {
        const req = hasKeyPath ? s.put(v as any) : s.put(v as any, k as IDBValidKey)
        await IDBPlusHelper.asyncRequest(req)
      }
    })
    return this
  }

  async deleteMany(keys: Iterable<K> | AsyncIterable<K>): Promise<number> {
    let deleted = 0
    await this._withStore('readwrite', async (s) => {
      for await (const k of keys as any) {
        const existed =
          (await IDBPlusHelper.asyncRequest<any>(s.get(k as IDBValidKey))) !== undefined
        if (existed) deleted++
        await IDBPlusHelper.asyncRequest(s.delete(k as IDBValidKey))
      }
    })
    return deleted
  }

  async disconnect(): Promise<void> {
    await IDBPlusHelper.closeConnection(this.dbName)
  }
}
