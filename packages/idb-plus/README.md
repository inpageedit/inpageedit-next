# IDB Plus

🗄️ Minimal Promise‑based IndexedDB wrapper with a Map‑like API. Written in TypeScript, ships typed ESM and CJS builds.

## Features

- Promise API with tiny, focused surface
- Map-like methods: `get`, `set`, `has`, `delete`, `clear`, `count`
- Easy async iteration: `for await...of store`, `keys()`, `values()`, `entries()`
- Bulk ops: `getMany`, `setMany`, `deleteMany`
- Auto-create object store and indexes on demand
- Built-in retry/backoff for transient IndexedDB errors
- Type-safe generics for key and value
- Tiny bundle size: `5.28 kB │ gzip: 2.06 kB`

## Install

```sh
# pnpm
pnpm add idb-plus

# npm
npm i idb-plus

# yarn
yarn add idb-plus
```

Works in modern browsers that support IndexedDB. Node.js is not supported unless you provide a browser-like IndexedDB implementation.

## Quick start

```ts
import { IDBPlus } from 'idb-plus'

type User = { id: string; name: string; age: number }

// Out-of-line keys (default): key is provided separately
const users = new IDBPlus<string, User>('my-app-db', 'users')

await users.set('u1', { id: 'u1', name: 'Ada', age: 30 })
console.log(await users.get('u1')) // -> { id: 'u1', name: 'Ada', age: 30 }
console.log(await users.get('not-found')) // -> undefined
console.log(await users.has('u1')) // -> true
console.log(await users.count()) // -> 1

// Iterate
for await (const [key, value] of users) {
  console.log(key, value)
}

// Bulk operations
await users.setMany([
  ['u2', { id: 'u2', name: 'Grace', age: 28 }],
  ['u3', { id: 'u3', name: 'Linus', age: 35 }],
])

// Batch read multiple keys
const results = await users.getMany(['u1', 'u2', 'u3', 'not-found'])
console.log(results.get('u1')) // -> User object
console.log(results.get('not-found')) // -> undefined

// Delete multiple keys, returns count of deleted items
const deletedCount = await users.deleteMany(['u2', 'u3'])
console.log(deletedCount) // -> 2
```

### Using inline keys (keyPath)

If you prefer inline keys (like an RDBMS primary key column), set `ensure.keyPath`.

```ts
import { IDBPlus } from 'idb-plus'

type User = { id: string; name: string; age: number }

const users = new IDBPlus<string, User>('my-app-db', 'users', {
  ensure: {
    keyPath: 'id',
    indexes: [{ name: 'by_name', keyPath: 'name' }],
  },
})

// With keyPath configured, IDB stores the key inside the object.
// The `set(key, value)` signature is preserved for uniformity,
// but the provided `key` parameter is ignored and the object is put by value.
await users.set('ignored', { id: 'u1', name: 'Ada', age: 30 })

// Note: For advanced index queries, you'll need to access the underlying
// IndexedDB API directly through the helper or implement your own transaction logic.
```

## API

### Class: `IDBPlus<K = IDBValidKey, V = any>`

Constructor

```ts
new IDBPlus<K, V>(dbName: string, storeName: string, options?: IDBPlusOptions)
```

- `dbName`: Database name
- `storeName`: Object store name
- `options.iterBatch?`: Batch size for async iteration (default: `100`). Controls how many items are fetched per transaction during iteration.
- `options.ensure?`: Creation options (see `EnsureStoreOptions` below)
- `options.retry?`: `{ attempts?: number; baseDelayMs?: number }` transient retry config (default: `{ attempts: 3, baseDelayMs: 16 }`)

Methods

- `get(key: K): Promise<V | undefined>` — Returns `undefined` if key not found (consistent with Map behavior)
- `set(key: K, value: V): Promise<this>` — Returns `this` for chaining
  - With `ensure.keyPath` configured (inline key), the `key` parameter is ignored and the object is stored by its internal key.
- `delete(key: K): Promise<boolean>` — Returns `true` if key existed, `false` otherwise
- `clear(): Promise<void>`
- `has(key: K): Promise<boolean>`
- `count(): Promise<number>`
- Iterables
  - `entries(): AsyncIterable<[K, V]>`
  - `keys(): AsyncIterable<K>`
  - `values(): AsyncIterable<V>`
  - `[Symbol.asyncIterator]()` — same as `entries()`
- Bulk ops
  - `getMany(keys: Iterable<K> | AsyncIterable<K>): Promise<Map<K, V | undefined>>`
    - Batch reads multiple keys; returns a Map with `undefined` for missing keys (consistent with Map behavior)
  - `setMany(entries: Iterable<[K, V]> | AsyncIterable<[K, V]>): Promise<this>`
  - `deleteMany(keys: Iterable<K> | AsyncIterable<K>): Promise<number>`
    - Returns the number of keys that were actually deleted
- `forEach(cb: (value: V, key: K, store: IDBPlus<K, V>) => void | Promise<void>): Promise<void>`
- `disconnect(): Promise<void>` — closes the database connection used by this instance

### Options & helpers

```ts
export interface IDBPlusOptions {
  iterBatch?: number
  ensure?: EnsureStoreOptions
  retry?: { attempts?: number; baseDelayMs?: number }
}

export interface EnsureStoreOptions {
  keyPath?: string | string[] | null
  autoIncrement?: boolean
  indexes?: { name: string; keyPath: string | string[]; options?: IDBIndexParameters }[]
}
```

Low-level utilities are available as `IDBPlusHelper` from the internal helper module (note: not exported from main entry, may require direct import from `idb-plus/src/helper` in some builds):

- `IDBPlusHelper.getDB(dbName, storeName, ensure?)` — Get or create database and store
- `IDBPlusHelper.closeConnection(dbName)` — Close a cached database connection
- `IDBPlusHelper.asyncRequest<T>(req: IDBRequest<T>): Promise<T>` — Convert IDBRequest to Promise
- `IDBPlusHelper.waitTx(tx: IDBTransaction): Promise<void>` — Wait for transaction completion
- `IDBPlusHelper.withRetry<T>(cfg, run, onFail?): Promise<T>` — Retry logic with exponential backoff
- `IDBPlusHelper.shouldReconnect(err): boolean` — Check if error requires reconnection
- `IDBPlusHelper.defaults` — Default configuration values (frozen object with `iterBatch: 100`, `retry: { attempts: 3, baseDelayMs: 16 }`)

## Error handling & retries

IndexedDB can throw transient errors (e.g., `InvalidStateError`, `AbortError`, `TransactionInactiveError`, version change races). `IDBPlus` includes a built-in retry mechanism with exponential backoff for all operations. Tune via `options.retry` (default: 3 attempts, 16ms base delay).

If multiple tabs upgrade the database, an automatic `versionchange` handler will close stale connections and refresh on next use. The retry mechanism will automatically reconnect on transient errors.

## Usage patterns

### Collect all items to an array

```ts
const allUsers = [] as { key: string; value: User }[]
for await (const [k, v] of users) allUsers.push({ key: k, value: v })
```

### Stream-like processing

```ts
await users.forEach(async (user, id, store) => {
  // do something async per record
  // callback receives: (value, key, store)
})
```

### Batch read multiple keys

```ts
// Get multiple keys at once
const results = await users.getMany(['u1', 'u2', 'u3'])
results.forEach((value, key) => {
  if (value !== undefined) {
    console.log(`${key}:`, value)
  }
})
```

### Efficient batched reads (cursor under the hood)

```ts
for await (const key of users.keys()) {
  // keys are fetched in batches defined by iterBatch
}
```

## Module formats

- ESM import (recommended):

```ts
import { IDBPlus } from 'idb-plus'
```

- CJS require:

```js
const { IDBPlus } = require('idb-plus')
```

Types are shipped via `dist/index.d.ts`.

## Browser support

Any modern browser with IndexedDB support (Chromium, Firefox, Safari, Edge). Private browsing modes may restrict storage; handle errors accordingly.

## FAQ

- "Why does `set(key, value)` ignore `key` when I use `keyPath`?"  
  When `ensure.keyPath` is set, the underlying object store uses inline keys. For simplicity the method signature stays the same, but the value's internal key is used. Keep the value's key field in sync.

- "How do I create indexes?"  
  Provide `ensure.indexes` at construction time. Missing indexes are created during the next upgrade. The schema is checked and updated automatically when needed.

- "Does `delete` return a boolean?"  
  Yes, `delete` returns `true` if the key existed and was deleted, `false` if the key didn't exist. `deleteMany` returns the count of keys that were actually deleted.

## Contributing

Issues and PRs are welcome. See repository: <https://github.com/inpageedit/inpageedit-next>

---

> [MIT License](https://opensource.org/licenses/MIT)
>
> IDBPlus Copyright © 2025-present dragon-fish
