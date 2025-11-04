import { Inject, InPageEdit, Schema, Service } from '@/InPageEdit.js'
import { IPEStorageRecord, AbstractIPEStorageManager } from '@/services/storage/index.js'
import { computeFallback, ComputeAble } from '@/utils/computeable.js'

declare module '@/InPageEdit' {
  export interface InPageEdit {
    preferences: PreferencesService
    // Alias
    prefs: PreferencesService
  }
}

export interface InPageEditPreferenceUICategory {
  name: string
  label: string
  description?: string
  index?: number
}

export interface InPageEditPreferenceUIRegistryItem {
  name: string
  schema: Schema
  category: string
}

@Inject(['storage'])
export class PreferencesService extends Service {
  private db: AbstractIPEStorageManager<any>
  public customRegistries: InPageEditPreferenceUIRegistryItem[] = []
  public categoryDefinitions: InPageEditPreferenceUICategory[] = []
  private _defaultPreferences: Record<string, any> = {}

  constructor(public ctx: InPageEdit) {
    super(ctx, 'preferences', true)
    ctx.set('prefs', this)
    this.db = ctx.storage.createDatabse<any>('preferences', Infinity)
  }

  get logger() {
    return this.ctx.logger('PREFERENCES')
  }

  async start() {
    this.defineCategory({
      name: 'general',
      label: 'General',
      description: 'General settings',
    })
    this.defineCategory({
      name: 'edit',
      label: 'Editing',
      description: 'Settings related to editing content',
    })
  }

  async get<T = any>(key: string, fallback?: ComputeAble<T>): Promise<T | null> {
    fallback ??= () => {
      const defaultValue = this.getDefaultValue(key)
      this.logger.debug(key, `(fallback value: ${defaultValue})`)
      return defaultValue as T
    }
    const value = (await this.db.get(key, undefined)) as T | null
    return value !== null ? value : ((await computeFallback(fallback)) as T)
  }

  getDefaultValue(key: string): unknown {
    return (this._defaultPreferences[key] ??= this.loadDefaultConfigs()[key])
  }

  set<T = any>(key: string, value: T): Promise<IPEStorageRecord<T> | void> {
    const defaultValue = this.getDefaultValue(key)
    if (value === defaultValue) {
      return this.db.delete(key)
    } else {
      return this.db.set(key, value)
    }
  }

  async setMany(record: Record<string, unknown>) {
    const defaults = this.loadDefaultConfigs()
    const filtered = Object.fromEntries(
      Object.entries(record).filter(([key, value]) => {
        const defaultValue = defaults[key]
        return value !== void 0 && value !== defaultValue
      })
    )
    await Promise.all(
      Object.entries(filtered).map(([key, value]) => {
        return this.set(key, value as any)
      })
    )
    return filtered
  }

  /**
   * 获取全部注册的配置项，以及正在生效的值
   */
  async getAll() {
    const data = this.loadDefaultConfigs()
    for await (const [key, record] of this.db.entries()) {
      // 旧版本埋的坑
      if (key === '_touched') continue
      data[key] = record.value
    }
    return data
  }

  /**
   * Get exportable configurations
   * - exclude values that are the same as the default value
   * - exclude invalid or undefined values
   * - sort by keys
   */
  async getExportableRecord(configs?: Record<string, unknown>) {
    configs ??= await this.getAll()
    const defaults = this.loadDefaultConfigs()

    const out: Record<string, any> = {}
    Object.entries(defaults)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([key, value]) => {
        const pref = configs[key]
        if (pref !== void 0 && pref !== value) {
          out[key] = pref
        }
      })
    return out
  }

  private loadDefaultConfigs() {
    const data = {} as Record<string, any>
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

    return data
  }

  registerCustomConfig(name: string, schema: Schema, category: string) {
    this.customRegistries.push({
      name,
      schema,
      category,
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
}
