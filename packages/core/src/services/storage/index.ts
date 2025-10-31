import { InPageEdit, Service } from '@/InPageEdit.js'
import { IPEStorageManager } from './IPEStorageManager.js'

declare module '@/InPageEdit' {
  export interface InPageEdit {
    storage: StorageService
  }
}

export class StorageService extends Service {
  constructor(ctx: InPageEdit) {
    super(ctx, 'storage', false)
  }

  createDatabse<T = any>(storeName: string, ttl?: number, version?: number) {
    return new IPEStorageManager<T>('InPageEdit', storeName, ttl, version)
  }
}

export interface IPEStorageRecord<T = any> {
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
  set(key: string, value: T): Promise<IPEStorageRecord<T>>
  has(key: string, ttl?: number): Promise<boolean>
  delete(key: string): Promise<void>
  keys(): AsyncIterable<string>
  values(): AsyncIterable<IPEStorageRecord<T>>
  entries(): AsyncIterable<[string, IPEStorageRecord<T>]>
  clear(): Promise<this>
}
