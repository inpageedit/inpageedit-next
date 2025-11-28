import { IDBStorageManager } from './managers/IDBStorageManager.js'

export * from './types.js'
export * from './managers/IDBStorageManager.js'

export interface FishStoreConfig {
  dbName: string
  storeName: string
  ttl?: number
  version?: number | string
}

export enum FishStoreEngine {
  indexedDB = 'indexedDB',
  localStorage = 'localStorage',
  sessionStorage = 'sessionStorage',
  memory = 'memory',
}

export const createFishStore = (config: FishStoreConfig, engine?: FishStoreEngine) => {
  engine ||= FishStoreEngine.indexedDB

  switch (engine) {
    case FishStoreEngine.indexedDB:
      return new IDBStorageManager(config.dbName, config.storeName, config.ttl, config.version)
    default:
      throw new Error(`Unsupported engine: ${engine}`)
  }
}
