import { Inject, InPageEdit, Schema, Service, type PreferencesMap } from '@/InPageEdit.js'
import { AbstractIPEStorageManager } from '@/services/storage/index.js'
import { computeFallback, ComputeAble } from '@/utils/computeable.js'
import { IDBStorageManager } from './storage/managers/IDBStorageManager'

declare module '@/InPageEdit' {
  export interface InPageEdit {
    preferences: PreferencesService
    // Alias
    prefs: PreferencesService
  }
  export interface Events {
    'preferences/changed'(payload: {
      ctx: InPageEdit
      /** original input */
      input: Record<string, unknown>
      /** changed settings */
      changes: Record<string, unknown>
    }): void
  }
}

export interface InPageEditPreferenceUICategory {
  name: string
  label: string
  description?: string
  index?: number
  /**
   * 自定义渲染函数
   * @param ctx - InPageEdit 上下文
   * @param onUnmount - 卸载回调，当偏好设置 UI 被卸载时会被调用
   */
  customRender?: (payload: {
    ctx: InPageEdit
    onMounted: (callback: (container: HTMLElement) => void) => void
    onUnmount: (callback: () => void) => void
  }) => Promise<Node> | Node
  /**
   * 是否自动生成该分类下的表单
   * @default true
   */
  autoGenerateForm?: boolean
}

export interface InPageEditPreferenceUIRegistryItem {
  name: string
  schema: Schema
  category: string
}

@Inject(['storage', 'wiki'])
export class PreferencesService extends Service {
  private db: AbstractIPEStorageManager<any>
  public customRegistries: InPageEditPreferenceUIRegistryItem[] = []
  public categoryDefinitions: InPageEditPreferenceUICategory[] = []
  private _defaultPreferences: Record<string, any> = {}

  constructor(public ctx: InPageEdit) {
    super(ctx, 'preferences', true)
    ctx.set('prefs', this)
    this.db = ctx.storage.createDatabase<any>(`preferences:${ctx.wiki.userInfo.id}`, Infinity)
    try {
      this._migrageFromLegacyMasterDB()
    } catch (e) {}
  }

  get logger() {
    return this.ctx.logger('PREFERENCES')
  }

  async start() {
    this.defineCategory({
      name: 'general',
      label: 'General',
      description: 'General settings',
      autoGenerateForm: true,
    })
    this.defineCategory({
      name: 'editor',
      label: 'Editor',
      description: 'Settings related to editing content',
      autoGenerateForm: true,
    })
  }

  // 重载魔术：一些类型体操……
  /**
   * 获取配置项的值
   * @param key 配置项的键名
   * @param fallback 当配置项不存在时的回退值
   * @returns
   * - 未提供 key 时，返回所有配置项的键值对
   * - 提供 key 时，返回对应配置项的值，若不存在则返回回退值或 null
   * @tips 你可以通过重载 PreferencesMap 来定义你的配置项类型，以自动获得类型推导
   */
  get(): Promise<PreferencesMap>
  get<K extends keyof PreferencesMap>(
    key: K,
    fallback?: ComputeAble<PreferencesMap[K]>
  ): Promise<PreferencesMap[K] | null>
  get<U = unknown>(key: string, fallback?: ComputeAble<U>): Promise<U | null>
  async get(key?: string, fallback?: ComputeAble<unknown>): Promise<unknown | null> {
    if (!key) {
      return this.getAll()
    }
    fallback ??= () => {
      const defaultValue = this.defaultOf(key as keyof PreferencesMap)
      this.logger.debug(key, `(fallback value: ${defaultValue})`)
      return defaultValue as unknown
    }
    const value = await this.db.get(key, undefined)
    return value !== null ? value : await computeFallback(fallback)
  }
  /**
   * 获取全部注册的配置项以及最终生效的值
   * 未保存的配置项将使用默认值
   */
  async getAll() {
    const data = this.loadDefaultConfigs()
    for await (const [key, record] of this.db.entries()) {
      // 旧版本埋的坑
      if (key === '_touched') continue
      if (key in data) {
        ;(data as any)[key] = record.value
      }
    }
    return data
  }

  set<K extends keyof PreferencesMap>(
    key: K,
    value: PreferencesMap[K] | undefined | null
  ): Promise<PreferencesMap[K] | void>
  set<U = unknown>(key: string, value: U | undefined | null): Promise<U | void>
  async set(key: string, value: unknown): Promise<unknown | void> {
    const result = await this.setMany({ [key]: value } as any)
    return (result as any)[key]
  }

  setMany(input: {
    [K in keyof PreferencesMap]?: PreferencesMap[K] | undefined | null
  }): Promise<{
    [K in keyof PreferencesMap]?: PreferencesMap[K] | undefined | null
  }>
  setMany<U = unknown>(
    input: Record<string, U | undefined | null>
  ): Promise<Record<string, U | undefined | null>>
  async setMany(input: Record<string, unknown>) {
    const defaults = this.loadDefaultConfigs()
    const changes: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(input)) {
      if (value === (defaults as any)[key] || value === void 0) {
        changes[key] = void 0
      } else {
        changes[key] = value
      }
    }
    await this.db.set(changes)
    this.ctx.emit('preferences/changed', { ctx: this.ctx, input, changes })
    return changes
  }

  defaultOf<T extends keyof PreferencesMap>(key: T): PreferencesMap[T] | undefined
  defaultOf<U = unknown>(key: string): U | undefined
  defaultOf(key: string) {
    return (this._defaultPreferences[key] ??=
      this.loadDefaultConfigs()[key as keyof PreferencesMap])
  }

  /**
   * Get exportable configurations
   * - exclude values that are the same as the default value
   * - exclude invalid or undefined values
   * - sort by keys
   */
  async getExportableRecord(configs?: Record<string, unknown>) {
    configs ??= (await this.getAll()) as any
    const defaults = this.loadDefaultConfigs()

    const out: Record<string, any> = {}
    Object.entries(defaults)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([key, value]) => {
        const pref = configs![key]
        if (pref !== void 0 && pref !== value) {
          out[key] = pref
        }
      })
    return out
  }

  private loadDefaultConfigs() {
    const data = {} as any
    this.getConfigRegistries().forEach((item) => {
      // 首先读取 schema 上的默认值
      try {
        const defaultValues = item.schema({}) as any
        Object.entries(defaultValues).forEach(([key, val]) => {
          data[key] = val
        })
      } catch {}
    })

    Object.entries(data).forEach(([key, val]) => {
      this._defaultPreferences[key] = val
    })

    return data as PreferencesMap
  }

  registerCustomConfig(id: string, schema: Schema, category?: string) {
    this.customRegistries.push({
      name: id,
      schema,
      category: category || 'general',
    })
    return this
  }

  getConfigRegistries(category?: string): InPageEditPreferenceUIRegistryItem[] {
    return Array.from(this.ctx.registry.entries())
      .map<{
        name: string
        schema: Schema
      }>(([plugin]) => {
        if (plugin === null) {
          return {
            name: '@root',
            schema: (InPageEdit as any)?.PreferencesSchema || null,
          }
        } else {
          return {
            name: plugin.name,
            schema: (plugin as any)?.PreferencesSchema || null,
          }
        }
      })
      .filter((item) => item.schema !== null)
      .map((item) => {
        return {
          ...item,
          category: item.schema.meta.category || 'general',
        }
      })
      .concat(this.customRegistries)
      .filter((item) => !category || item.category === category)
  }
  getAllSchema() {
    return new Schema<PreferencesMap>(
      Schema.intersect(this.getConfigRegistries().map((item) => item.schema))
    )
  }

  defineCategory(category: InPageEditPreferenceUICategory) {
    const index = this.categoryDefinitions.findIndex((tab) => tab.name === category.name)
    if (index < 0) {
      this.categoryDefinitions.push(category)
    } else {
      this.categoryDefinitions[index] = category
    }
    this.categoryDefinitions.sort((a, b) => {
      return (a.index ?? 0) - (b.index ?? 0)
    })
    return this
  }

  getConfigCategories() {
    return this.categoryDefinitions
  }

  private async _migrageFromLegacyMasterDB() {
    const legacyDB = this.ctx.storage.createDatabase<any>('preferences', Infinity)
    let count = 0
    for await (const [key, record] of legacyDB.entries()) {
      if (key === '_touched') continue
      await this.db.set(key, record.value)
      count++
    }
    count && this.logger.info(`Migrated ${count} preferences from master DB`)
    await legacyDB.clear()
    await (legacyDB as IDBStorageManager)?.db?.disconnect?.()
    return count
  }
}
