import { EnsureStoreOptions, IDBHelper, IDBStoreHandle } from './helper.js'

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
   * @default { attempts: 2, baseDelayMs: 16 }
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
  private readonly iterBatch: number
  private readonly retry?: { attempts?: number; baseDelayMs?: number }
  private readonly inlineKey: boolean
  private readonly idbStoreHandle: Promise<IDBStoreHandle>

  constructor(
    readonly dbName: string,
    readonly storeName: string,
    options: IDBPlusOptions = {}
  ) {
    this.iterBatch = (options.iterBatch ?? 100) | 0
    this.retry = options.retry
    this.inlineKey = !!options.ensure?.keyPath
    this.idbStoreHandle = IDBHelper.createStore(dbName, storeName, options.ensure ?? {})
  }

  async get(key: K): Promise<V | undefined> {
    const h = await this.idbStoreHandle
    return IDBHelper.get<V>(h, key)
  }

  async set(key: K, value: V): Promise<void> {
    const h = await this.idbStoreHandle
    if (this.inlineKey) {
      return IDBHelper.withObjectStore<void>(
        h,
        'readwrite',
        async (os) => {
          const req = os.put(value as any)
          await IDBHelper.promisifyRequest(req)
        },
        this.retry
      )
    } else {
      return IDBHelper.set(h, key, value)
    }
  }

  async delete(key: K): Promise<void> {
    const h = await this.idbStoreHandle
    return IDBHelper.del(h, key)
  }

  async clear(): Promise<void> {
    const h = await this.idbStoreHandle
    return IDBHelper.clear(h)
  }

  async has(key: K): Promise<boolean> {
    const h = await this.idbStoreHandle
    return IDBHelper.withObjectStore<boolean>(
      h,
      'readonly',
      async (os) => {
        const req = os.count(key as any)
        const n = await IDBHelper.promisifyRequest<number>(req)
        return n > 0
      },
      this.retry
    )
  }

  async count(): Promise<number> {
    const h = await this.idbStoreHandle
    return IDBHelper.withObjectStore<number>(
      h,
      'readonly',
      async (os) => {
        const req = os.count()
        return IDBHelper.promisifyRequest<number>(req)
      },
      this.retry
    )
  }

  entries(): AsyncIterable<[K, V]> {
    const self = this
    return {
      [Symbol.asyncIterator]() {
        let it: AsyncIterator<[IDBValidKey, any]> | null = null
        return {
          async next(): Promise<IteratorResult<[K, V]>> {
            if (!it) {
              const h = await self.idbStoreHandle
              it = IDBHelper.entries(h, self.iterBatch)[Symbol.asyncIterator]()
            }
            const r = await it.next()
            return r as any
          },
        }
      },
    }
  }

  keys(): AsyncIterable<K> {
    const self = this
    return {
      [Symbol.asyncIterator]() {
        let it: AsyncIterator<IDBValidKey> | null = null
        return {
          async next(): Promise<IteratorResult<K>> {
            if (!it) {
              const h = await self.idbStoreHandle
              it = IDBHelper.keys(h, self.iterBatch)[Symbol.asyncIterator]()
            }
            const r = await it.next()
            return r as any
          },
        }
      },
    }
  }

  values(): AsyncIterable<V> {
    const self = this
    return {
      [Symbol.asyncIterator]() {
        const eIt = self.entries()[Symbol.asyncIterator]()
        return {
          async next(): Promise<IteratorResult<V>> {
            const r = await eIt.next()
            if (r.done) return { value: undefined as any, done: true }
            return { value: (r.value as [K, V])[1], done: false }
          },
        }
      },
    }
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

  async setMany(entries: Iterable<[K, V]> | AsyncIterable<[K, V]>): Promise<void> {
    const h = await this.idbStoreHandle
    await IDBHelper.withObjectStore(
      h,
      'readwrite',
      async (os) => {
        for await (const [k, v] of toAsync(entries)) {
          const req = this.inlineKey ? os.put(v as any) : os.put(v as any, k as any)
          await IDBHelper.promisifyRequest(req)
        }
      },
      this.retry
    )
  }

  async deleteMany(keys: Iterable<K> | AsyncIterable<K>): Promise<void> {
    const h = await this.idbStoreHandle
    await IDBHelper.withObjectStore(
      h,
      'readwrite',
      async (os) => {
        for await (const k of toAsync(keys)) {
          const req = os.delete(k as any)
          await IDBHelper.promisifyRequest(req)
        }
      },
      this.retry
    )
  }

  async tx<T>(mode: IDBTransactionMode, fn: (os: IDBObjectStore) => Promise<T> | T): Promise<T> {
    const h = await this.idbStoreHandle
    return IDBHelper.withObjectStore<T>(h, mode, fn, this.retry)
  }

  async close(): Promise<void> {
    await IDBHelper.closeDatabase(this.dbName)
  }
}

function toAsync<T>(src: Iterable<T> | AsyncIterable<T>): AsyncIterable<T> {
  if ((src as any)[Symbol.asyncIterator]) return src as AsyncIterable<T>
  return {
    async *[Symbol.asyncIterator]() {
      for (const v of src as Iterable<T>) yield v
    },
  }
}
