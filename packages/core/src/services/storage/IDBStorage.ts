export interface IDBStoreDefinition {
  dbName: string
  storeName: string
  dbPromise: Promise<IDBDatabase>
}

export namespace IDBHelper {
  /** Promisify IDBRequest */
  export function promisifyRequest<T = unknown>(req: IDBRequest<T>) {
    return new Promise<T>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result as T)
      req.onerror = () => reject(req.error)
    })
  }

  // -----------------------------
  // Connection & upgrade control
  // -----------------------------

  // Maintain a long-lived connection per database
  const _connections: Map<string, Promise<IDBDatabase>> = new Map()

  // Serialize per-db upgrade flows to avoid racing bumps
  const _upgradeLocks: Map<string, Promise<unknown>> = new Map()

  function runSerial<T>(key: string, job: () => Promise<T>): Promise<T> {
    const prev = _upgradeLocks.get(key) ?? Promise.resolve()
    const next = prev.then(job, job)
    // keep a handled promise so the chain doesn't reject
    _upgradeLocks.set(
      key,
      next.catch(() => {})
    )
    return next
  }

  /** Open a database with a cached long-lived connection. */
  export function openDatabase(dbName: string): Promise<IDBDatabase> {
    if (_connections.has(dbName)) return _connections.get(dbName) as Promise<IDBDatabase>

    const p = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbName)
      req.onupgradeneeded = () => {
        // no-op: stores are created lazily in createStore()
      }
      req.onsuccess = () => {
        const db = req.result
        // Auto-close & invalidate cache on versionchange to unblock upgrades elsewhere
        db.onversionchange = () => {
          try {
            db.close()
          } finally {
            _connections.delete(dbName)
          }
        }
        resolve(db)
      }
      req.onerror = () => reject(req.error)
      req.onblocked = () => {
        // Optional: could log or expose a callback; we'll just wait.
      }
    })

    _connections.set(dbName, p)
    return p
  }

  /** Close a given database connection (and drop cache). */
  export async function closeDatabase(dbName: string) {
    const p = _connections.get(dbName)
    if (!p) return
    try {
      ;(await p).close()
    } finally {
      _connections.delete(dbName)
    }
  }

  /** Close all cached database connections. */
  export async function closeAllDatabases() {
    const names = Array.from(_connections.keys())
    await Promise.all(names.map(closeDatabase))
  }

  /**
   * Ensure an object store exists. If missing, bump IDB version to create it.
   * Concurrent calls are serialized per db to avoid racing upgrades.
   */
  export async function createStore(dbName: string, storeName: string): Promise<IDBDatabase> {
    return runSerial(dbName, async () => {
      let db = await openDatabase(dbName)
      if (db.objectStoreNames.contains(storeName)) return db

      const newVersion = db.version + 1
      db.close()

      const p = new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(dbName, newVersion)
        req.onupgradeneeded = () => {
          const udb = req.result
          if (!udb.objectStoreNames.contains(storeName)) {
            udb.createObjectStore(storeName)
          }
        }
        req.onsuccess = () => {
          const udb = req.result
          udb.onversionchange = () => {
            try {
              udb.close()
            } finally {
              _connections.delete(dbName)
            }
          }
          resolve(udb)
        }
        req.onerror = () => reject(req.error)
        req.onblocked = () => {
          // Optional: surface UI to close other tabs. We'll rely on versionchange in other contexts.
        }
      })

      _connections.set(dbName, p)
      return p
    })
  }

  /** Convenience: open & ensure store, return a store definition. */
  export async function openStore(dbName: string, storeName: string): Promise<IDBStoreDefinition> {
    return { dbName, storeName, dbPromise: createStore(dbName, storeName) }
  }

  // -----------------------------
  // Transactions
  // -----------------------------

  export async function withObjectStore<T>(
    store: IDBStoreDefinition,
    mode: IDBTransactionMode,
    fn: (os: IDBObjectStore) => Promise<T> | T
  ): Promise<T> {
    const db = await store.dbPromise
    const tx = db.transaction(store.storeName, mode)
    const os = tx.objectStore(store.storeName)

    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })

    try {
      const result = await fn(os)
      await done
      return result
    } catch (e) {
      try {
        tx.abort()
      } catch {}
      throw e
    }
  }

  // -----------------------------
  // KV helpers
  // -----------------------------

  export async function get<T = unknown>(
    store: IDBStoreDefinition,
    key: IDBValidKey
  ): Promise<T | undefined> {
    return withObjectStore<T | undefined>(store, 'readonly', async (os) => {
      const req = os.get(key)
      return promisifyRequest<T | undefined>(req)
    })
  }

  export async function set(
    store: IDBStoreDefinition,
    key: IDBValidKey,
    value: unknown
  ): Promise<void> {
    return withObjectStore<void>(store, 'readwrite', async (os) => {
      const req = os.put(value as any, key)
      await promisifyRequest(req)
    })
  }

  export async function del(store: IDBStoreDefinition, key: IDBValidKey): Promise<void> {
    return withObjectStore<void>(store, 'readwrite', async (os) => {
      const req = os.delete(key)
      await promisifyRequest(req)
    })
  }

  export async function clear(store: IDBStoreDefinition): Promise<void> {
    return withObjectStore<void>(store, 'readwrite', async (os) => {
      const req = os.clear()
      await promisifyRequest(req)
    })
  }

  export async function keys(store: IDBStoreDefinition): Promise<IDBValidKey[]> {
    return withObjectStore<IDBValidKey[]>(store, 'readonly', async (os) => {
      const anyOs: any = os
      if (typeof anyOs.getAllKeys === 'function') {
        const req = anyOs.getAllKeys()
        const res = await promisifyRequest<IDBValidKey[]>(req)
        return res
      }
      // Fallback: iterate by cursor
      const out: IDBValidKey[] = []
      await new Promise<void>((resolve, reject) => {
        const cursorReq = os.openKeyCursor()
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result
          if (!cursor) return resolve()
          out.push(cursor.key)
          cursor.continue()
        }
        cursorReq.onerror = () => reject(cursorReq.error)
      })
      return out
    })
  }

  export async function entries(store: IDBStoreDefinition): Promise<[IDBValidKey, any][]> {
    return withObjectStore(store, 'readonly', async (os) => {
      const items: [IDBValidKey, any][] = []
      // Prefer getAll/getAllKeys when available for fewer round-trips
      const anyOs: any = os
      if (typeof anyOs.getAll === 'function' && typeof anyOs.getAllKeys === 'function') {
        const [vals, ks] = await Promise.all([
          promisifyRequest<any[]>(anyOs.getAll()),
          promisifyRequest<IDBValidKey[]>(anyOs.getAllKeys()),
        ])
        for (let i = 0; i < ks.length; i++) items.push([ks[i], vals[i]])
        return items
      }
      // Fallback: cursor
      await new Promise<void>((resolve, reject) => {
        const cursorReq = os.openCursor()
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result as IDBCursorWithValue | null
          if (!cursor) return resolve()
          items.push([cursor.key, cursor.value])
          cursor.continue()
        }
        cursorReq.onerror = () => reject(cursorReq.error)
      })
      return items
    })
  }

  export function entriesIter(
    store: IDBStoreDefinition,
    batchSize = 100
  ): AsyncIterable<[IDBValidKey, any]> {
    return {
      [Symbol.asyncIterator]() {
        let buffer: [IDBValidKey, any][] = []
        let done = false
        let lastKey: IDBValidKey | undefined = undefined

        const fillBuffer = async () => {
          if (done) return
          buffer = []
          await withObjectStore(store, 'readonly', async (os) => {
            const range =
              lastKey === undefined ? undefined : IDBKeyRange.lowerBound(lastKey, /* open */ true)
            await new Promise<void>((resolve, reject) => {
              let count = 0
              const req = os.openCursor(range, 'next')
              req.onsuccess = () => {
                const cursor = req.result as IDBCursorWithValue | null
                if (!cursor || count >= batchSize) {
                  resolve()
                  return
                }
                buffer.push([cursor.key, cursor.value])
                lastKey = cursor.key
                count++
                cursor.continue()
              }
              req.onerror = () => reject(req.error)
            })
            if (buffer.length === 0) {
              done = true
            }
          })
        }

        return {
          async next(): Promise<IteratorResult<[IDBValidKey, any]>> {
            if (buffer.length === 0 && !done) {
              await fillBuffer()
            }
            if (buffer.length === 0) {
              return { value: undefined, done: true }
            }
            const value = buffer.shift()!
            return { value, done: false }
          },
        }
      },
    }
  }

  export function keysIter(store: IDBStoreDefinition, batchSize = 200): AsyncIterable<IDBValidKey> {
    const iter = entriesIter(store, batchSize)
    return {
      [Symbol.asyncIterator]() {
        const it = iter[Symbol.asyncIterator]()
        return {
          async next(): Promise<IteratorResult<IDBValidKey>> {
            const r = await it.next()
            if (r.done) return { value: undefined, done: true }
            return { value: r.value[0], done: false }
          },
        }
      },
    }
  }
}

export class IDBStorage<K extends IDBValidKey, V> implements AsyncIterable<[K, V]> {
  private readonly store: IDBStoreDefinition
  private readonly iterBatch: number

  private constructor(store: IDBStoreDefinition, iterBatch = 128) {
    this.store = store
    this.iterBatch = iterBatch
  }

  static async open<K extends IDBValidKey, V>(
    dbName: string,
    storeName: string,
    iterBatch = 128
  ): Promise<IDBStorage<K, V>> {
    const store = await IDBHelper.openStore(dbName, storeName)
    return new IDBStorage<K, V>(store, iterBatch)
  }

  async get(key: K): Promise<V | undefined> {
    return IDBHelper.get<V>(this.store, key)
  }

  async set(key: K, value: V): Promise<this> {
    await IDBHelper.set(this.store, key, value)
    return this
  }

  async delete(key: K): Promise<boolean> {
    const existed = (await this.get(key)) !== undefined
    await IDBHelper.del(this.store, key)
    return existed
  }

  async has(key: K): Promise<boolean> {
    return (await this.get(key)) !== undefined
  }

  async clear(): Promise<void> {
    await IDBHelper.clear(this.store)
  }

  /**
   * @note expensive operation: iterates all keys to count them
   */
  async size(): Promise<number> {
    let n = 0
    for await (const _k of IDBHelper.keysIter(this.store, this.iterBatch)) n++
    return n
  }

  entries(batchSize = this.iterBatch): AsyncIterable<[K, V]> {
    const iter = IDBHelper.entriesIter(this.store, batchSize)
    return {
      [Symbol.asyncIterator]() {
        const it = iter[Symbol.asyncIterator]()
        return {
          async next(): Promise<IteratorResult<[K, V]>> {
            const r = await it.next()
            if (r.done) return { value: undefined, done: true }
            // 类型断言成 K,V
            return { value: [r.value[0] as K, r.value[1] as V], done: false }
          },
        }
      },
    }
  }

  keys(batchSize = this.iterBatch): AsyncIterable<K> {
    const iter = IDBHelper.entriesIter(this.store, batchSize)
    return {
      [Symbol.asyncIterator]() {
        const it = iter[Symbol.asyncIterator]()
        return {
          async next(): Promise<IteratorResult<K>> {
            const r = await it.next()
            if (r.done) return { value: undefined, done: true }
            return { value: r.value as unknown as K, done: false }
          },
        }
      },
    }
  }

  values(batchSize = this.iterBatch): AsyncIterable<V> {
    const entries = this.entries(batchSize)[Symbol.asyncIterator]()
    return {
      [Symbol.asyncIterator]() {
        return {
          async next(): Promise<IteratorResult<V>> {
            const r = await entries.next()
            if (r.done) return { value: undefined, done: true }
            return { value: r.value[1] as V, done: false }
          },
        }
      },
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<[K, V]> {
    return this.entries(this.iterBatch)[Symbol.asyncIterator]()
  }

  async forEach(
    callback: (value: V, key: K, map: IDBStorage<K, V>) => void | Promise<void>
  ): Promise<void> {
    for await (const [k, v] of this.entries()) {
      await callback(v, k, this)
    }
  }

  async toArray(limit = Infinity): Promise<Array<[K, V]>> {
    const out: Array<[K, V]> = []
    let count = 0
    for await (const pair of this) {
      out.push(pair)
      if (++count >= limit) break
    }
    return out
  }
}
