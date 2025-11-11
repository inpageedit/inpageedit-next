import { InPageEdit, Schema } from '@/InPageEdit'
import { ForkScope, Inject } from '@cordisjs/core'
import { defineAsyncComponent, type App as VueApp } from 'vue'
import { PluginStoreRegistry, PluginStoreSchemas } from './schema'
import { AbstractIPEStorageManager } from '@/services/storage/index.js'

declare module '@/InPageEdit' {
  interface InPageEdit {
    store: PluginPluginStore
  }
  interface PreferencesMap {
    'pluginStore.registries': string[]
    'pluginStore.plugins': { source?: 'online_manifest' | 'npm'; registry: string; id: string }[]
    'pluginStore.cdnForNpm': string
  }
}

export type PluginStoreRegistrySource = 'online_manifest' | 'npm'

const tryGetGlobalPlugin = (main_export: string) => {
  if (!main_export) return null
  try {
    return main_export
      .split('.')
      .reduce<any>((acc, key) => (acc == null ? acc : acc[key]), globalThis as any)
  } catch {
    return null
  }
}

/**
 * 解析资源URL
 * @param resourcePath - entry或style路径，可能是相对路径或完整URL
 * @param baseUrl - registry中的base_url，可能是完整URL或相对路径
 * @param registryUrl - registry的URL（必须是绝对URL，作为相对baseUrl时的基准）
 * @returns 解析后的完整URL
 */
const resolveResourceUrl = (resourcePath: string, baseUrl: string, registryUrl: string): string => {
  // 完整URL：直接返回
  if (/^https?:\/\//i.test(resourcePath)) return resourcePath

  // 兜底：规范化一个“带尾斜杠”的 helper
  const ensureSlash = (s: string) => (s.endsWith('/') ? s : s + '/')

  // 如果 baseUrl 是完整URL：直接用它当基准（并确保目录语义）
  if (/^https?:\/\//i.test(baseUrl)) {
    const normalizedBase = ensureSlash(baseUrl)
    return new URL(resourcePath, normalizedBase).href
  }

  // baseUrl 是相对路径（如 './' 或 '/plugins'）
  // 先把 baseUrl 相对于 registryUrl 解析成绝对URL
  // 注意：当 baseUrl 是 '/plugins' 这种根相对路径时，new URL 会以 registryUrl 的 origin 作为根。
  const registryAbs = (() => {
    try {
      return new URL(registryUrl).href
    } catch {
      // 极端情况（开发环境传了相对 registry），用页面 origin 兜底
      return new URL(registryUrl, location.origin).href
    }
  })()

  const resolvedBaseUrl = new URL(ensureSlash(baseUrl), registryAbs).href
  return new URL(resourcePath, resolvedBaseUrl).href
}

@Inject(['storage', 'preferences', 'resourceLoader', '$'])
export class PluginPluginStore extends BasePlugin {
  // re-export for external usage
  static readonly PluginStoreSchemas = PluginStoreSchemas
  static REGISTRY_INFO_CACHE_TTL = 1000 * 60 * 60 * 24 // 1 day
  static REGISTRY_INFO_STORAGE_NAME = 'plugin-store-registry'
  static REGISTRY_ETAG_STORAGE_NAME = 'psreg-etag'
  private regInfoDB: AbstractIPEStorageManager<PluginStoreRegistry>

  constructor(public ctx: InPageEdit) {
    super(ctx, {}, 'plugin-store')
    ctx.set('store', this)
    this.regInfoDB = ctx.storage.createDatabase<PluginStoreRegistry>(
      PluginPluginStore.REGISTRY_INFO_STORAGE_NAME,
      PluginPluginStore.REGISTRY_INFO_CACHE_TTL,
      1,
      'indexedDB'
    )
  }

  protected async start() {
    this._installUserPlugins()
    this._injectPreferenceUI()
  }

  private async _installUserPlugins() {
    const prefs = await this.ctx.preferences.get('pluginStore.plugins', [])
    if (!prefs?.length) {
      return
    }
    for (const pref of prefs) {
      this.install(pref.registry, pref.id, pref.source)
    }
  }

  private async _createManagementApp() {
    const ctx = await this.ctx.withInject(['store'])
    const PluginStoreApp = defineAsyncComponent(() => import('./components/PluginStoreApp.vue'))
    const app = createVueAppWithIPE(ctx, PluginStoreApp)
    return app
  }

  private async _injectPreferenceUI() {
    const ctx = this.ctx
    const $ = ctx.$

    ctx.preferences.defineCategory({
      name: 'plugin-store',
      label: $`Plugin Store`,
      description: $`Plugin Store`,
      index: 90,
      autoGenerateForm: false,
      customRenderer: async ({ onUnmount }) => {
        const container = <div id="ipe-plugin-store-preferences-vue"></div>
        const app = await this._createManagementApp()
        app.mount(container)

        onUnmount(() => {
          app.unmount()
          this.ctx.logger.debug('Plugin Store preferences app unmounted')
        })

        return (
          <section>
            {container}
            {/* <div className="theme-ipe-prose">
              <hr />
              <div style={{ textAlign: 'center', marginBottom: '1em', fontSize: '0.8em' }}>
                🚫 DO NOT edit fields below manually 🚫
              </div>
            </div> */}
          </section>
        )
      },
    })

    ctx.preferences.registerCustomConfig(
      'plugin-store',
      Schema.object({
        'pluginStore.registries': Schema.array(Schema.string())
          .default([
            import.meta.env.PROD
              ? Endpoints.PLUGIN_REGISTRY_URL
              : 'http://127.0.0.1:1005/src/__test__/plugin-registry/index.json',
          ])
          .description($`Registry URLs`)
          .hidden(),
        'pluginStore.cdnForNpm': Schema.string()
          .description($`CDN to install packages from npm`)
          .default('https://cdn.jsdelivr.net/npm/{{ package }}{{ version ? "@" + version : "" }}')
          .hidden(),
        'pluginStore.plugins': Schema.array(
          Schema.object({
            source: Schema.union(['online_manifest', 'npm']).default('online_manifest'),
            registry: Schema.string().required(),
            id: Schema.string().required(),
          })
        )
          .description($`Installed plugins`)
          .default([])
          .hidden(),
      }),
      'plugin-store'
    )
  }

  async showModal() {
    const modal = this.ctx.modal.show({
      title: $`Plugin Store`,
      sizeClass: 'small',
    })
    const container = <section id="ipe-plugin-store-vue"></section>
    modal.setContent(container)
    const app = await this._createManagementApp()
    app.mount(container)
    modal.on(modal.Event.Close, () => {
      app.unmount()
    })
    return modal
  }

  private _installedPlugins = new Map<string, Promise<ForkScope<InPageEdit> | null>>()
  async install(
    registry: string,
    id: string,
    source: PluginStoreRegistrySource = 'online_manifest'
  ): Promise<ForkScope<InPageEdit> | null> {
    const registryInfo = await this.getRegistryInfo(registry, source)
    if (!registryInfo) {
      this.ctx.logger.warn(`Registry ${registry} not found`)
      return null
    }
    const key = `${registry}#${id}`
    if (this._installedPlugins.has(key)) {
      return (await this._installedPlugins.get(key)) ?? null
    }
    // 2) 把 registry 原始 URL 传进去，供 URL 解析使用
    const scope = this._installOneByRegistryInfo(registry, registryInfo, id)
    this._installedPlugins.set(key, scope)
    return await scope
  }
  async uninstall(registry: string, id: string): Promise<boolean> {
    const promise = this._installedPlugins.get(`${registry}#${id}`)
    if (promise === void 0) {
      return true // not installed or already uninstalled
    }
    this._installedPlugins.delete(`${registry}#${id}`)
    const scope = await promise
    if (scope) {
      return scope.dispose?.() ?? true // disposed successfully
    }
    return true // not a plugin, just removed from the list
  }

  async addToPreferences(registry: string, id: string) {
    let prefs =
      (await this.ctx.preferences.get<{ registry: string; id: string }[]>('pluginStore.plugins')) ||
      []
    const existed = prefs.some((p) => p.registry === registry && p.id === id)
    if (existed) {
      return true
    }
    prefs.push({ registry, id })
    await this.ctx.preferences.set('pluginStore.plugins', prefs)
    return true
  }
  async removeFromPreferences(registry: string, id: string) {
    let prefs =
      (await this.ctx.preferences.get<{ registry: string; id: string }[]>('pluginStore.plugins')) ||
      []
    prefs = prefs.filter((p) => p.registry !== registry || p.id !== id)
    await this.ctx.preferences.set('pluginStore.plugins', prefs)
    return true
  }

  async installAndSetPreference(registry: string, id: string) {
    await this.addToPreferences(registry, id)
    return this.install(registry, id)
  }
  async uninstallAndRemovePreference(registry: string, id: string) {
    await this.removeFromPreferences(registry, id)
    return this.uninstall(registry, id)
  }

  // 3) 增加 registryUrl 参数
  private async _installOneByRegistryInfo(
    registryUrl: string,
    registryInfo: PluginStoreRegistry,
    id: string
  ): Promise<ForkScope<InPageEdit> | null> {
    const baseUrl = registryInfo.base_url
    const pkg = registryInfo.packages.find((p) => p.id === id)
    if (!pkg) {
      this.ctx.logger.warn(`Package ${id} not found in registry ${registryUrl}`)
      return null
    }

    const loader = pkg.loader
    const { kind, entry = 'index.js', styles = [], main_export = null } = loader

    // 4) 统一用 resolveResourceUrl 解析入口
    let entryUrl: string | null = null
    if (kind !== 'styles') {
      if (!entry) {
        this.ctx.logger.warn(`Entry url missing for ${id}`, loader)
        return null
      }
      try {
        entryUrl = resolveResourceUrl(entry, baseUrl, registryUrl)
      } catch (e) {
        this.ctx.logger.warn(
          `Failed to resolve entry "${entry}" with base "${baseUrl}" and registry "${registryUrl}"`,
          e
        )
        return null
      }
    }

    const datasets = {
      'data-plugin-registry': registryUrl,
      'data-plugin-id': id,
    }

    let fork: ForkScope<InPageEdit> | null = null

    switch (kind) {
      case 'autoload': {
        fork = this.ctx.plugin({
          inject: ['resourceLoader'],
          name: `plugin-store-${registryUrl}-${id}`,
          apply: (ctx) => {
            if (!entryUrl) return
            ctx.resourceLoader.loadScript(entryUrl, { ...datasets })
          },
        })
        break
      }
      case 'module': {
        if (!entryUrl) {
          this.ctx.logger.warn(`Entry url missing for module kind, package ${id}`)
          return null
        }
        const apply = await import(/* @vite-ignore */ entryUrl).then(
          (m) => (main_export ? m[main_export] : m.default) ?? m
        )
        if (!apply) {
          this.ctx.logger.warn(`Main export ${main_export} not found in module ${entryUrl}`)
          return null
        }
        fork = this.ctx.plugin(apply)
        break
      }
      case 'umd': {
        let apply = tryGetGlobalPlugin(main_export!)
        if (!apply) {
          if (!entryUrl) {
            this.ctx.logger.warn(`Entry url missing for umd kind, package ${id}`)
            return null
          }
          await this.ctx.resourceLoader.loadScript(entryUrl, { ...datasets })
          apply = tryGetGlobalPlugin(main_export!)
        }
        if (!apply) {
          this.ctx.logger.warn(
            `Main export ${main_export} not found on globalThis after loading ${entryUrl}`
          )
          return null
        }
        fork = this.ctx.plugin(apply)
        break
      }
      case 'styles': {
        // 没有脚本，仅样式。下面统一样式注入逻辑会覆盖
        break
      }
    }

    // 5) 统一解析并注入样式（兼容绝对URL与相对 + base_url 的组合）
    if (styles && styles.length > 0) {
      let urls: string[] = []
      try {
        urls = styles.map((u) => resolveResourceUrl(u, baseUrl, registryUrl)).filter(Boolean)
      } catch (e) {
        this.ctx.logger.warn(`Failed to resolve styles for ${id}`, styles, e)
      }

      // 确保存在父 fork
      fork ||= this.ctx.plugin({ name: `plugin-store-${registryUrl}-${id}`, apply() {} })

      // 在子插件里加载样式，并在卸载时清理
      fork.ctx.plugin({
        inject: ['resourceLoader'],
        name: `plugin-store-${registryUrl}-${id}-styles`,
        apply: (ctx) => {
          urls.forEach((u) => ctx.resourceLoader.loadStyle(u, { ...datasets }))
          ctx.on('dispose', () => {
            try {
              urls.forEach((u) => ctx.resourceLoader.removeStyle(u))
            } catch (e) {
              console.info('styles cleanup failed', e)
            }
          })
        },
      })
    }

    return fork
  }

  validateRegistry(data: any): PluginStoreRegistry {
    return PluginStoreSchemas.Registry(data)
  }

  async getRegistryInfo(
    registry: string,
    source: PluginStoreRegistrySource = 'online_manifest',
    noCache = false
  ): Promise<PluginStoreRegistry> {
    try {
      let info: PluginStoreRegistry
      switch (source) {
        case 'online_manifest': {
          info = await this._fetchOnlineRegistryInfo(registry, noCache)
          this.logger.debug('Fetched registry info from online manifest', info)
          this.setRegistryCache(registry, info)
          break
        }
        default: {
          throw new Error(`Unsupported registry source: ${source}`)
        }
      }

      return info
    } catch (e) {
      this.ctx.logger.warn('Failed to fetch registry info', e)
    }

    const info = await this.getRegistryCache(registry)
    if (!info) {
      throw new Error(`Failed to fetch registry info: ${registry}`)
    }
    return info
  }

  private _onlineRegistryQueries = new Map<string, Promise<PluginStoreRegistry>>()
  private async _fetchOnlineRegistryInfo(
    registry: string,
    noCache = false
  ): Promise<PluginStoreRegistry> {
    if (!noCache && this._onlineRegistryQueries.has(registry)) {
      return await this._onlineRegistryQueries.get(registry)!
    }
    const task = async () => {
      const payload: RequestInit = {
        method: 'GET',
      }
      if (noCache) {
        payload.cache = 'no-store'
      }
      const response = await fetch(registry, payload)
      const data = await response.json()
      const validated = this.validateRegistry(data)
      return validated
    }
    const promise = task()
    this._onlineRegistryQueries.set(registry, promise)
    return await promise
  }

  private async getRegistryCache(registry: string) {
    const data = await this.regInfoDB.get(registry)
    if (data) {
      try {
        const validated = this.validateRegistry(data)
        return validated
      } catch (e) {
        this.ctx.logger.warn('Invalid cached registry', e, data)
        this.regInfoDB.delete(registry)
      }
    }
    return null
  }
  private async setRegistryCache(registry: string, data: PluginStoreRegistry) {
    return this.regInfoDB.set(registry, data)
  }
  private async deleteRegistryCache(registry: string) {
    await this.regInfoDB.delete(registry)
  }
  async clearAllRegistryCaches() {
    await this.regInfoDB.clear()
    this.ctx.logger.debug('All registry caches cleared')
  }

  /**
   * 刷新指定 registry 的缓存（重新从网络获取）
   */
  async refreshRegistryCache(registry: string): Promise<PluginStoreRegistry> {
    const data = await this.getRegistryInfo(registry, 'online_manifest', true)
    if (!data) {
      throw new Error(`Failed to refresh registry cache: ${registry}`)
    }
    this.ctx.logger.debug('Registry cache refreshed:', registry)
    return data
  }

  /**
   * 刷新所有已配置的 registry 缓存
   */
  async refreshAllRegistryCaches(): Promise<Record<string, PluginStoreRegistry | null>> {
    const registryUrls = (await this.ctx.preferences.get('pluginStore.registries')) || []
    const responses = await Promise.allSettled(
      registryUrls.map((url) => this.refreshRegistryCache(url))
    )
    const results: Record<string, PluginStoreRegistry | null> = {}
    for (const [index, response] of responses.entries()) {
      if (response.status === 'fulfilled') {
        results[registryUrls[index]] = response.value
      } else {
        results[registryUrls[index]] = null
      }
    }
    return results
  }
}
