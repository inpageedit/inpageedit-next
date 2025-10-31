import { Inject, InPageEdit, Schema, Service } from '@/InPageEdit.js'
import { IPEStorageRecord, AbstractIPEStorageManager } from '@/services/storage/index.js'
import { computeFallback, ComputeAble } from '@/utils/computeable.js'
import { WatchlistAction } from '@/models/WikiPage/types/WatchlistAction.js'
import { IWikiTitle } from '@/models/WikiTitle/index.js'

declare module '@/InPageEdit' {
  export interface InPageEdit {
    preferences: PreferencesService
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

  async getAll() {
    const data = this.loadDefaultConfigs()
    for await (const [key, record] of this.db.entries()) {
      // 旧版本埋的坑
      if (key === '_touched') continue
      data[key] = record.value
    }
    return data
  }

  async getExportable() {
    const all = await this.getAll()
    const defaults = this.loadDefaultConfigs()

    // 移除内部使用的键
    const out: Record<string, any> = {}
    Object.entries(defaults).forEach(([key, value]) => {
      const pref = all[key]
      if (pref !== value) {
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

  /**
   * 获取用户页配置文件的标题
   */
  private getUserPrefsPageTitle(): IWikiTitle | null {
    try {
      const userName = this.ctx.wiki?.userInfo?.name
      if (!userName) {
        return null
      }
      // 使用 User: 命名空间
      return this.ctx.wikiTitle.newTitle(`User:${userName}/ipe-prefs.json`, 2)
    } catch {
      return null
    }
  }

  /**
   * 从用户页加载配置
   */
  async importFromUserPage(): Promise<Record<string, unknown>> {
    const title = this.getUserPrefsPageTitle()
    if (!title) {
      this.logger.debug('Cannot get user page title, skipping load')
      return {}
    }

    try {
      // 使用 raw action 获取 JSON 内容
      const rawUrl = title.getURL({ action: 'raw', ctype: 'application/json' })

      let response: Response
      try {
        response = await fetch(rawUrl.toString())
        if (!response.ok) {
          if (response.status === 404) {
            this.logger.debug('User preferences page does not exist')
            return {}
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
      } catch (error) {
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
          this.logger.debug('User preferences page does not exist or network error')
          return {}
        }
        throw error
      }

      // 解析 JSON 内容
      let preferences: Record<string, any>
      try {
        preferences = await response.json()
      } catch (error) {
        this.logger.warn('Failed to parse user preferences JSON:', error)
        return {}
      }

      for (const [key, value] of Object.entries(preferences)) {
        await this.set(key, value)
      }

      this.logger.info('Loaded preferences from user page:', title)
      return preferences
    } catch (error) {
      this.logger.error('Failed to load preferences from user page:', error)
      return {}
    }
  }

  /**
   * 导出配置到用户页
   */
  async exportToUserPage(): Promise<IWikiTitle> {
    const title = this.getUserPrefsPageTitle()
    if (!title) {
      throw new Error('Cannot get user page title')
    }

    const json = await this.getExportable()
    const text = JSON.stringify(json, null, 2)

    try {
      const page = this.ctx.wikiPage.newBlankPage({
        title: title.toString(),
        ns: 2, // User namespace
      })
      await page.edit({
        text,
        summary: 'Update InPageEdit preferences',
        watchlist: WatchlistAction.nochange,
      })

      this.logger.info('Exported preferences to user page:', title)
      return title
    } catch (error) {
      this.logger.error('Failed to export preferences to user page:', error)
      throw error
    }
  }
}
