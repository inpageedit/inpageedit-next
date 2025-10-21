import { Inject, InPageEdit, Schema } from '@/InPageEdit.js'
import { IPEStorageItem, IPEStorageManager } from '@/services/StorageService.js'
import { computeFallback, ComputeAble } from '@/utils/computeable.js'

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
  private _defaultPreferences: Record<string, any> = {}

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

    this.registerCustomConfig(
      'about',
      Schema.object({
        about: Schema.const(
          <div className="prose">
            <h2>✏️ InPageEdit NEXT</h2>
            <i>v{this.ctx.version}</i>
            <h2>Portal</h2>
            <div style="display: flex; flex-direction: column; gap: 1rem">
              <ActionButton href="https://www.ipe.wiki" style={{ display: 'block', width: '100%' }}>
                Official Website & Help Center
              </ActionButton>
              <ActionButton
                href="https://www.ipe.wiki/update/"
                style={{ display: 'block', width: '100%' }}
              >
                Update Logs
              </ActionButton>
            </div>
            <h2>Join us</h2>
            <ul>
              <li>
                <strong>GitHub</strong>:{' '}
                <a href="https://github.com/inpageedit/inpageedit-next" target="_blank">
                  inpageedit/inpageedit-next
                </a>
              </li>
              <li>
                <strong>QQ Group</strong>: 1026023666
              </li>
            </ul>
            <hr />
            <p>🚀 Modular, Extensible Supercharged Plugin for MediaWiki.</p>
            <p>InPageEdit-NEXT Copyright © 2025-present dragon-fish</p>
          </div>
        ).role('raw-html'),
      }).description(''),
      'about',
      {}
    )

    import('./ui/index').then((module) => {
      const fork = this.ctx.plugin(module.PluginPreferencesUI)
      this.addDisposeHandler(() => {
        fork.dispose()
      })
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

  set<T = any>(key: string, value: T): Promise<IPEStorageItem<T> | void> {
    const defaultValue = this.getDefaultValue(key)
    if (value === defaultValue) {
      return this.db.delete(key)
    } else {
      return this.db.set(key, value)
    }
  }

  async getAll() {
    const data = this.loadDefaultConfigs()
    await this.db.iterate((value: IPEStorageItem, key: string) => {
      data[key] = value
    })
    return data
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

      // 然后读取注册时定义的默认值
      item.defaults &&
        Object.entries(item.defaults).forEach(([key, val]) => {
          data[key] = val
        })
    })

    Object.entries(data).forEach(([key, val]) => {
      this._defaultPreferences[key] = val
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
            name: '@root',
            schema: (InPageEdit as any)?.PreferencesSchema || null,
            defaults: (InPageEdit as any)?.PreferencesDefaults || {},
          }
        } else {
          return {
            name: plugin.name,
            schema: (plugin as any)?.PreferencesSchema || null,
            defaults: (plugin as any)?.PreferencesDefaults || {},
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
