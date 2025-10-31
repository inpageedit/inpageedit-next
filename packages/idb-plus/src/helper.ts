export interface IDBIndexDef {
  name: string
  keyPath: string | string[]
  options?: IDBIndexParameters
}

export interface EnsureStoreOptions {
  /** keyPath for objectStore; default undefined (out-of-line keys) */
  keyPath?: string | string[] | null
  /** autoIncrement for objectStore; default false */
  autoIncrement?: boolean
  /** indexes to ensure exist on the store (missing ones will be created on upgrade) */
  indexes?: IDBIndexDef[]
}

export interface IDBStoreHandle {
  dbName: string
  storeName: string
  /** Always returns a *current* connection; no stale db caching leaks to callers. */
  getDb(): Promise<IDBDatabase>
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
    _upgradeLocks.set(
      key,
      next.catch(() => {})
    )
    return next
  }

  /** Small sleep with jitter for backoff */
  function delay(ms: number) {
    return new Promise<void>((r) => setTimeout(r, ms + Math.floor(Math.random() * 8)))
  }

  /** Classify IDB errors that are worth retrying */
  function isRetryableIDBError(err: unknown): boolean {
    if (!(err instanceof DOMException)) return false
    const name = err.name
    const msg = String((err as any)?.message ?? '')
    return (
      name === 'InvalidStateError' || // connection closing/closed
      name === 'TransactionInactiveError' ||
      name === 'NotFoundError' || // store/index briefly missing during upgrade
      (name === 'AbortError' && /versionchange|closing|internal/i.test(msg))
    )
  }

  /** Open a database with a cached long-lived connection. */
  export function openDatabase(dbName: string): Promise<IDBDatabase> {
    const cached = _connections.get(dbName)
    if (cached) return cached

    const p = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbName)
      req.onupgradeneeded = () => {
        // no-op: stores are created lazily in ensureStore()
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
        // Optional: expose UI; here we just wait.
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

  /** Delete a database completely (closes cached connection first). */
  export async function deleteDatabase(dbName: string): Promise<void> {
    await closeDatabase(dbName)
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(dbName)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
      req.onblocked = () => {
        // Up to caller to notify user to close other tabs
      }
    })
  }

  /**
   * Ensure an object store (and optional indexes) exist. If missing, bump version to create.
   * Concurrent calls are serialized per db to avoid racing upgrades.
   */
  export async function ensureStore(
    dbName: string,
    storeName: string,
    opts: EnsureStoreOptions = {}
  ): Promise<IDBDatabase> {
    return runSerial(dbName, async () => {
      let db = await openDatabase(dbName)
      const needCreate = !db.objectStoreNames.contains(storeName)

      // Even if store exists, we may need to ensure indexes.
      const needIndexes = !needCreate && opts.indexes && opts.indexes.length > 0

      if (!needCreate && !needIndexes) {
        return db
      }

      const newVersion = db.version + 1
      db.close()

      const p = new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(dbName, newVersion)
        req.onupgradeneeded = () => {
          const udb = req.result

          let os: IDBObjectStore
          if (!udb.objectStoreNames.contains(storeName)) {
            os = udb.createObjectStore(storeName, {
              keyPath: opts.keyPath ?? undefined,
              autoIncrement: !!opts.autoIncrement,
            })
          } else {
            os = req.transaction!.objectStore(storeName)
          }

          if (opts.indexes && opts.indexes.length > 0) {
            for (const { name, keyPath, options } of opts.indexes) {
              if (!os.indexNames.contains(name)) {
                os.createIndex(name, keyPath as any, options)
              }
            }
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
          // Optional: surface UI to close other tabs.
        }
      })

      _connections.set(dbName, p)
      return p
    })
  }

  /** Convenience: open & ensure store, return a store handle. */
  export async function createStore(
    dbName: string,
    storeName: string,
    opts: EnsureStoreOptions = {}
  ): Promise<IDBStoreHandle> {
    await ensureStore(dbName, storeName, opts)
    return {
      dbName,
      storeName,
      getDb: () => openDatabase(dbName),
    }
  }

  // -----------------------------
  // Transactions (auto-retry)
  // -----------------------------

  /**
   * Run a function inside a transaction on one object store.
   * Auto-recovers from transient IDB failures by reopening/ensuring and retrying (limited attempts).
   */
  export async function withObjectStore<T>(
    handle: IDBStoreHandle,
    mode: IDBTransactionMode,
    fn: (os: IDBObjectStore) => Promise<T> | T,
    /** customize retry attempts/backoff if needed */
    retry: { attempts?: number; baseDelayMs?: number } = {}
  ): Promise<T> {
    const { dbName, storeName } = handle
    const MAX_RETRIES = retry.attempts ?? 2
    const BASE = retry.baseDelayMs ?? 16
    let lastErr: unknown

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt === 0) {
          // First attempt: ensure existence (serialized upgrade if needed)
          await ensureStore(dbName, storeName)
        }

        const db = await openDatabase(dbName)

        let tx: IDBTransaction
        try {
          tx = db.transaction(storeName, mode)
        } catch (e) {
          if (isRetryableIDBError(e) && attempt < MAX_RETRIES) {
            await closeDatabase(dbName)
            await delay(BASE * (1 << attempt))
            lastErr = e
            continue
          }
          throw e
        }

        const os = tx.objectStore(storeName)
        const done = new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
          tx.onabort = () => reject(tx.error)
        })

        try {
          const result = await fn(os)
          await done
          return result
        } catch (opErr) {
          // Decide whether to retry
          if (isRetryableIDBError(opErr) && attempt < MAX_RETRIES) {
            try {
              tx.abort()
            } catch {}
            await closeDatabase(dbName)
            await delay(BASE * (1 << attempt))
            lastErr = opErr
            continue
          }
          try {
            tx.abort()
          } catch {}
          throw opErr
        }
      } catch (outer) {
        if (isRetryableIDBError(outer) && attempt < MAX_RETRIES) {
          await closeDatabase(dbName)
          await delay(BASE * (1 << attempt))
          lastErr = outer
          continue
        }
        throw outer
      }
    }

    throw lastErr
  }

  // -----------------------------
  // KV helpers
  // -----------------------------

  export async function get<T = unknown>(
    handle: IDBStoreHandle,
    key: IDBValidKey
  ): Promise<T | undefined> {
    return withObjectStore<T | undefined>(handle, 'readonly', async (os) => {
      const req = os.get(key)
      return promisifyRequest<T | undefined>(req)
    })
  }

  export async function set(
    handle: IDBStoreHandle,
    key: IDBValidKey,
    value: unknown
  ): Promise<void> {
    return withObjectStore<void>(handle, 'readwrite', async (os) => {
      const req = os.put(value as any, key)
      await promisifyRequest(req)
    })
  }

  export async function del(handle: IDBStoreHandle, key: IDBValidKey): Promise<void> {
    return withObjectStore<void>(handle, 'readwrite', async (os) => {
      const req = os.delete(key)
      await promisifyRequest(req)
    })
  }

  export async function clear(handle: IDBStoreHandle): Promise<void> {
    return withObjectStore<void>(handle, 'readwrite', async (os) => {
      const req = os.clear()
      await promisifyRequest(req)
    })
  }

  export function entries(
    handle: IDBStoreHandle,
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
          await withObjectStore(handle, 'readonly', async (os) => {
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
              return { value: undefined as any, done: true }
            }
            const value = buffer.shift()!
            return { value, done: false }
          },
        }
      },
    }
  }

  export function keys(handle: IDBStoreHandle, batchSize = 200): AsyncIterable<IDBValidKey> {
    const iter = entries(handle, batchSize)
    return {
      [Symbol.asyncIterator]() {
        const it = iter[Symbol.asyncIterator]()
        return {
          async next(): Promise<IteratorResult<IDBValidKey>> {
            const r = await it.next()
            if (r.done) return { value: undefined as any, done: true }
            return { value: r.value[0], done: false }
          },
        }
      },
    }
  }
}
