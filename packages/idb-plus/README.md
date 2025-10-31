# IDB Plus

🗄️ Minimal Promise‑based IndexedDB wrapper with a Map‑like API. Written in TypeScript, ships typed ESM and CJS builds.

## Features

- Promise API with tiny, focused surface
- Map-like methods: `get`, `set`, `has`, `delete`, `clear`, `count`
- Easy async iteration: `for await...of store`, `keys()`, `values()`, `entries()`
- Bulk ops: `setMany`, `deleteMany`
- Auto-create object store and indexes on demand
- Built-in retry/backoff for transient IndexedDB errors
- Type-safe generics for key and value
- Tiny bundle size: `dist/index.js  10.32 kB │ gzip: 2.76 kB │ map: 31.17 kB`

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

await users.deleteMany(['u2', 'u3'])
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

// Custom transaction to query by index
const found = await users.tx('readonly', async (os) => {
  const idx = os.index('by_name')
  return await new Promise<User | undefined>((resolve, reject) => {
    const req = idx.get('Ada')
    req.onsuccess = () => resolve(req.result as User | undefined)
    req.onerror = () => reject(req.error)
  })
})
```

## API

### Class: `IDBPlus<K = IDBValidKey, V = any>`

Constructor

```ts
new IDBPlus<K, V>(dbName: string, storeName: string, options?: IDBPlusOptions)
```

- `dbName`: Database name
- `storeName`: Object store name
- `options.iterBatch?`: Batch size for async iteration (default: `100`)
- `options.ensure?`: Creation options (see EnsureStoreOptions)
- `options.retry?`: `{ attempts?: number; baseDelayMs?: number }` transient retry config (default: `2` attempts, base `16ms`)

Methods

- `get(key: K): Promise<V | undefined>`
- `set(key: K, value: V): Promise<void>`
  - With `ensure.keyPath` configured (inline key), the `key` parameter is ignored and the object is stored by its internal key.
- `delete(key: K): Promise<void>`
- `clear(): Promise<void>`
- `has(key: K): Promise<boolean>`
- `count(): Promise<number>`
- Iterables
  - `entries(): AsyncIterable<[K, V]>`
  - `keys(): AsyncIterable<K>`
  - `values(): AsyncIterable<V>`
  - `[Symbol.asyncIterator]()` — same as `entries()`
- Bulk ops
  - `setMany(entries: Iterable<[K, V]> | AsyncIterable<[K, V]>)`
  - `deleteMany(keys: Iterable<K> | AsyncIterable<K>)`
- Transactions
  - `tx<T>(mode: IDBTransactionMode, fn: (os: IDBObjectStore) => Promise<T> | T): Promise<T>`
    - Runs `fn` within a single-store transaction; auto-retries transient IDB errors.
- `close(): Promise<void>` — closes the database connection used by this instance

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

Low-level utilities are also exported as `IDBHelper` for advanced use:

- `IDBHelper.ensureStore(dbName, storeName, opts)`
- `IDBHelper.createStore(dbName, storeName, opts)` → `IDBStoreHandle`
- `IDBHelper.openDatabase(dbName)` / `closeDatabase(dbName)` / `closeAllDatabases()` / `deleteDatabase(dbName)`
- Transaction helper: `IDBHelper.withObjectStore(handle, mode, fn, retry?)`
- KV helpers: `get`, `set`, `del`, `clear`, `entries`, `keys`

## Error handling & retries

IndexedDB can throw transient errors (e.g., `InvalidStateError`, version change races). `IDBPlus` and `IDBHelper.withObjectStore` include a small retry mechanism with exponential backoff. Tune via `options.retry` on `IDBPlus` or `retry` in `withObjectStore`.

If multiple tabs upgrade the database, an automatic `versionchange` handler will close stale connections and refresh on next use.

## Usage patterns

### Collect all items to an array

```ts
const allUsers = [] as { key: string; value: User }[]
for await (const [k, v] of users) allUsers.push({ key: k, value: v })
```

### Stream-like processing

```ts
await users.forEach(async (user, id) => {
  // do something async per record
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

- “Why does `set(key, value)` ignore `key` when I use `keyPath`?”  
  When `ensure.keyPath` is set, the underlying object store uses inline keys. For simplicity the method signature stays the same, but the value’s internal key is used. Keep the value’s key field in sync.

- “How do I create indexes?”  
  Provide `ensure.indexes` at construction time. Missing indexes are created during the next upgrade.

## Contributing

Issues and PRs are welcome. See repository: <https://github.com/inpageedit/inpageedit-next>

---

> [MIT License](https://opensource.org/licenses/MIT)
>
> IDBPlus Copyright © 2025-present dragon-fish
