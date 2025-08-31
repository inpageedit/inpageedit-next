import { Inject, InPageEdit, Schema } from '@/InPageEdit'
import { IPEStorageItem, IPEStorageManager } from '@/services/StorageService'

declare module '@/InPageEdit' {
  export interface InPageEdit {
    preferences: PluginPreferences
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
  defaults: Record<string, any>
  category: string
}

@Inject(['sitemeta', 'storage'])
export class PluginPreferences extends BasePlugin {
  private db: IPEStorageManager<any>
  public customRegistries: InPageEditPreferenceUIRegistryItem[] = []
  public categoryDefinitions: InPageEditPreferenceUICategory[] = []

  constructor(public ctx: InPageEdit) {
    super(ctx, {}, 'preferences')
    this.db = ctx.storage.createDatabse<any>('preferences', Infinity)
    this.ctx.set('preferences', this)
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
    this.defineCategory({
      name: 'about',
      label: 'About',
      description: 'About InPageEdit',
      index: 99,
    })

    import('./PluginPreferencesUI').then((module) => {
      const fork = this.ctx.plugin(module.PluginPreferencesUI)
      this.addDisposeHandler(() => {
        fork.dispose()
      })
    })
  }

  get<T = any>(key: string, fallback?: () => T | Promise<T>): Promise<T | null> {
    fallback ||= () => {
      const defaultValue = this.getDefaultConfigs()[key]
      console.info('default value used', defaultValue)
      return defaultValue as T
    }
    const value = this.db.get(key, undefined, fallback)
    console.info(value)
    return value
  }

  set<T = any>(key: string, value: T) {
    return this.db.set(key, value)
  }

  async getAll() {
    const data = {} as Record<string, any>
    await this.db.iterate((value: IPEStorageItem, key: string) => {
      data[key] = value
    })
    return {
      ...data,
      ...this.getDefaultConfigs(),
    }
  }

  private getDefaultConfigs() {
    const data = {} as Record<string, any>
    this.getConfigRegistries().forEach((item) => {
      item.defaults &&
        Object.entries(item.defaults).forEach(([key, val]) => {
          data[key] = val
        })
    })
    return data
  }

  registerCustomConfig(
    name: string,
    schema: Schema,
    category: string,
    defaults: Record<string, any>
  ) {
    this.customRegistries.push({
      name,
      schema,
      category,
      defaults,
    })
    return this
  }

  getConfigRegistries(category?: string): InPageEditPreferenceUIRegistryItem[] {
    return Array.from(this.ctx.registry.entries())
      .map<{
        name: string
        schema: Schema
        defaults: Record<string, any>
      }>(([plugin, fork]) => {
        if (plugin === null) {
          return {
            name: 'root',
            schema: (InPageEdit as any)?.ConfigSchema || null,
            defaults: (InPageEdit as any)?.ConfigDefaults || {},
          }
        } else {
          return {
            name: plugin.name,
            schema: (plugin as any)?.ConfigSchema || null,
            defaults: (plugin as any)?.ConfigDefaults || {},
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
      .filter((item) => !category || item.category === category)
      .concat(this.customRegistries)
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
