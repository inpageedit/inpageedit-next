export interface EnsureStoreOptions {
  /** keyPath for objectStore; default undefined (out-of-line keys) */
  keyPath?: string | string[] | null
  /** autoIncrement for objectStore; default false */
  autoIncrement?: boolean
  /** indexes to ensure exist on the store (missing ones will be created on upgrade) */
  indexes?: IDBIndexDef[]
}

export interface IDBIndexDef {
  name: string
  keyPath: string | string[]
  options?: IDBIndexParameters
}

export namespace IDBPlusHelper {
  // Long-lived connection cache per DB name
  export const cache = new Map<string, Promise<IDBDatabase>>()

  export const defaults = Object.freeze({ iterBatch: 100, retry: { attempts: 3, baseDelayMs: 16 } })

  export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

  export function shouldReconnect(err: unknown): boolean {
    const name = (err as any)?.name ?? ''
    // Heuristics for "connection dropped" scenarios
    return (
      name === 'AbortError' ||
      name === 'InvalidStateError' ||
      name === 'TransactionInactiveError' ||
      name === 'UnknownError'
    )
  }

  export async function withRetry<T>(
    cfg: { attempts: number; baseDelayMs: number },
    run: (attempt: number) => Promise<T>,
    onFail?: (err: unknown, attempt: number) => Promise<void> | void
  ): Promise<T> {
    const attempts = Math.max(1, cfg.attempts)
    for (let i = 0; i < attempts; i++) {
      try {
        return await run(i)
      } catch (err) {
        if (i === attempts - 1) throw err
        await onFail?.(err, i)
        const backoff = cfg.baseDelayMs * Math.pow(2, i) + Math.floor(Math.random() * 10)
        await sleep(backoff)
      }
    }
    // unreachable
    throw new Error('withRetry exhausted unexpectedly')
  }

  function openRaw(
    dbName: string,
    version?: number,
    upgrade?: (db: IDBDatabase, tx: IDBTransaction) => void
  ) {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbName, version)
      req.onupgradeneeded = () => {
        try {
          const db = req.result
          const tx = req.transaction!
          upgrade?.(db, tx)
        } catch (e) {
          reject(e)
        }
      }
      req.onerror = () => reject(req.error)
      req.onblocked = () => {
        // no-op; another tab holds an older version open
      }
      req.onsuccess = () => {
        const db = req.result
        db.onversionchange = () => {
          // Force clients to lazily reconnect
          try {
            db.close()
          } finally {
            cache.delete(dbName)
          }
        }
        resolve(db)
      }
    })
  }

  async function ensureSchema(
    db: IDBDatabase,
    storeName: string,
    ensure?: EnsureStoreOptions
  ): Promise<IDBDatabase> {
    let needStore = !db.objectStoreNames.contains(storeName)
    let missingIdx: IDBIndexDef[] = []

    if (!needStore && ensure?.indexes?.length) {
      // Inspect indexes on an existing store
      const t = db.transaction(storeName, 'readonly')
      const s = t.objectStore(storeName)
      const set = new Set(Array.from(s.indexNames))
      missingIdx = (ensure.indexes || []).filter((d) => !set.has(d.name))
      // finalize the read-only tx
      await new Promise<void>((res, rej) => {
        t.oncomplete = () => res()
        t.onabort = () => rej(t.error)
        t.onerror = () => rej(t.error)
      })
    }

    if (!needStore && missingIdx.length === 0) return db

    // Bump version to trigger upgrade
    const nextVer = db.version + 1
    db.close()
    const upgraded = await openRaw(db.name, nextVer, (ndb, vtx) => {
      let store: IDBObjectStore
      if (!ndb.objectStoreNames.contains(storeName)) {
        store = ndb.createObjectStore(storeName, {
          keyPath: ensure?.keyPath ?? undefined,
          autoIncrement: !!ensure?.autoIncrement,
        })
      } else {
        store = vtx.objectStore(storeName)
      }
      for (const idx of missingIdx) {
        if (!store.indexNames.contains(idx.name)) {
          store.createIndex(idx.name, idx.keyPath as any, idx.options)
        }
      }
    })
    upgraded.onversionchange = () => {
      try {
        upgraded.close()
      } finally {
        cache.delete(upgraded.name)
      }
    }
    return upgraded
  }

  export async function getDB(dbName: string, storeName: string, ensure?: EnsureStoreOptions) {
    let p = cache.get(dbName)
    if (!p) {
      p = (async () => {
        const db = await openRaw(dbName)
        return ensureSchema(db, storeName, ensure)
      })()
      cache.set(dbName, p)
    } else {
      // Verify schema lazily in case of first-time callers with different store requirements
      p = p.then((db) => ensureSchema(db, storeName, ensure))
      cache.set(dbName, p)
    }
    return p
  }

  export async function closeConnection(dbName: string) {
    const p = cache.get(dbName)
    cache.delete(dbName)
    if (p) {
      try {
        ;(await p).close()
      } catch {}
    }
  }

  export function asyncRequest<T = any>(req: IDBRequest<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result as T)
      req.onerror = () => reject(req.error)
    })
  }

  export function waitTx(tx: IDBTransaction): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onabort = () => reject(tx.error ?? new DOMException('Aborted', 'AbortError'))
      tx.onerror = () => reject(tx.error ?? new DOMException('TransactionError', 'UnknownError'))
    })
  }
}
