import { ComputeAble } from './computeable'

export interface IFishStorageEntry<T = unknown> {
  /** last update time */
  time: number
  /** stored value */
  value: T
  /** version */
  version?: number | string
}

export interface IFishStorageManager<T = unknown> {
  get(key: string, ttl?: number, setter?: ComputeAble<T>): Promise<T | null>
  getMany(keys: string[], ttl?: number): Promise<Record<string, IFishStorageEntry<T> | null>>
  set(key: string, value: null | undefined): Promise<void>
  set(key: string, value: T): Promise<IFishStorageEntry<T>>
  setMany(
    record: Record<string, T | null | undefined>
  ): Promise<Record<string, IFishStorageEntry<T> | void>>
  has(key: string, ttl?: number): Promise<boolean>
  delete(key: string): Promise<void>
  deleteMany(keys: string[]): Promise<number>
  keys(): AsyncIterable<string>
  values(): AsyncIterable<IFishStorageEntry<T>>
  entries(): AsyncIterable<[string, IFishStorageEntry<T>]>
  updatedAt(key: string): Promise<number>
  getRaw(key: string): Promise<IFishStorageEntry<T> | null>
  clear(): Promise<this>
}
