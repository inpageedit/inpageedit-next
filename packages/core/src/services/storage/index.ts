import { InPageEdit, Service } from '@/InPageEdit.js'
import { LocalStorageManager } from './managers/LocalStorageManager.js'
import { IDBStorageManager } from './managers/IDBStorageManager.js'

declare module '@/InPageEdit' {
  export interface InPageEdit {
    storage: StorageService
  }
}

export interface StorageServiceConfig {
  dbName: string
}

export class StorageService extends Service<StorageServiceConfig> {
  readonly kv: IDBStorageManager<any>
  readonly simpleKV: LocalStorageManager<any>
  readonly memoryKV: LocalStorageManager<any>
  constructor(
    ctx: InPageEdit,
    public config: StorageServiceConfig
  ) {
    super(ctx, 'storage', false)
    this.kv = this.createDatabase<any>('key-val', 0, 1, 'indexedDB') as IDBStorageManager<any>
    this.simpleKV = this.createDatabase<any>('~', 0, 1, 'localStorage') as LocalStorageManager<any>
    this.memoryKV = this.createDatabase<any>('~', 0, 1, 'memory') as LocalStorageManager<any>
  }

  createDatabase<T = any>(
    storeName: string,
    ttl?: number,
    version?: number,
    engine: 'indexedDB' | 'localStorage' | 'sessionStorage' | 'memory' = 'indexedDB'
  ): AbstractIPEStorageManager<T> {
    const canUseIDB = 'indexedDB' in window && window.indexedDB !== null
    if (engine === 'indexedDB' && !canUseIDB) {
      engine = 'localStorage'
    }
    switch (engine) {
      case 'indexedDB':
        return new IDBStorageManager<T>(this.config.dbName, storeName, ttl, version)
      case 'localStorage':
      case 'sessionStorage':
      case 'memory':
        return new LocalStorageManager<T>(this.config.dbName, storeName, ttl, version, engine)
      default:
        throw new Error(`Unsupported storage engine: ${engine}`)
    }
  }
}

export interface TypedStorageEntry<T = any> {
  /** last update time */
  time: number
  /** stored value */
  value: T
  /** version */
  version?: number
}

export interface AbstractIPEStorageManager<T = unknown> {
  get(key: string, ttl?: number, setter?: () => Promise<any> | any): Promise<T | null>
  set(key: string, value: null | undefined): Promise<void>
  set(
    record: Record<string, T | null | undefined>
  ): Promise<Record<string, TypedStorageEntry<T> | void>>
  set(key: string, value: T): Promise<TypedStorageEntry<T>>
  has(key: string, ttl?: number): Promise<boolean>
  delete(key: string): Promise<void>
  keys(): AsyncIterable<string>
  values(): AsyncIterable<TypedStorageEntry<T>>
  entries(): AsyncIterable<[string, TypedStorageEntry<T>]>
  updatedAt(key: string): Promise<number>
  clear(): Promise<this>
}
