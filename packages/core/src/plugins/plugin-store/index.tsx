import { InPageEdit, Schema } from '@/InPageEdit'
import { ForkScope, Inject } from '@cordisjs/core'
import type { App as VueApp } from 'vue'
import PluginStoreApp from './components/PluginStoreApp.vue'
import { PluginStoreRegistry, PluginStoreSchemas } from './schema'
import { AbstractIPEStorageManager } from '@/services/storage/index.js'

declare module '@/InPageEdit' {
  interface InPageEdit {
    store: PluginPluginStore
  }
}

const tryGetGlobalPlugin = (main_export: string) => {
  let apply = (globalThis as any)[main_export!]
  if (
    typeof apply === 'function' ||
    (typeof apply === 'object' && typeof apply?.apply === 'function')
  ) {
    return apply
  }
  return null
}

@Inject({
  storage: {
    required: true,
  },
  resourceLoader: {
    required: true,
  },
  preferences: {
    required: false,
  },
})
export class PluginPluginStore extends BasePlugin {
  constructor(public ctx: InPageEdit) {
    super(ctx, {}, 'plugin-store')
    ctx.set('store', this)
    this._injectPreferenceUI()
    this.registryCacheDB = ctx.storage.createDatabse<PluginStoreRegistry>(
      'plugin-store-registry-caches',
      1000 * 60 * 60 * 24, // 1 day
      1
    )
  }
  private registryCacheDB: AbstractIPEStorageManager<PluginStoreRegistry>

  static readonly PluginStoreSchemas = PluginStoreSchemas

  private async _createManagementApp(ctx = this.ctx) {
    const registryUrl = await ctx.preferences.get('pluginStore.registryUrl')
    const app = createVueAppWithIPE(ctx, PluginStoreApp, {
      registryUrl,
    })
    return app
  }

  private async _injectPreferenceUI() {
    const ctx = await this.ctx.useScope(['store', 'preferences'])
    ctx.preferences.defineCategory({
      name: 'plugin-store',
      label: 'Plugin Store',
      description: 'Plugin Store',
      index: 90,
    })

    ctx.preferences.registerCustomConfig(
      'plugin-store',
      Schema.object({
        // TODO: 先写死，后面改
        'pluginStore.registryUrl': Schema.string()
          .default(
            import.meta.env.PROD
              ? 'https://plugins.ipe.wiki/registry.json'
              : 'http://127.0.0.1:1005/src/__test__/plugin-registry/index.json'
          )
          .hidden(),
        'pluginStore._browseButton': Schema.const(
          <section>
            <button className="btn primary" onClick={() => this.showModal()}>
              Browse Plugins
            </button>
          </section>
        ).role('raw-html'),
        'pluginStore.plugins': Schema.array(
          Schema.object({
            registry: Schema.string().required(),
            id: Schema.string().required(),
          })
        )
          .description('Installed plugins')
          .default([]),
      }),
      'plugin-store'
    )
  }

  private _vueApp: VueApp | null = null
  async showModal() {
    const modal = this.ctx.modal.show({
      title: 'Plugin Store',
    })
    const container = <section id="ipe-plugin-store-vue"></section>
    modal.setContent(container)
    const app = await this._createManagementApp(this.ctx)
    app.mount(container)
    modal.on(modal.Event.Close, () => {
      app.unmount()
      this._vueApp = null
    })
    return modal
  }

  private _installedPlugins = new Map<string, Promise<ForkScope<InPageEdit> | null>>()
  async install(registry: string, id: string): Promise<ForkScope<InPageEdit> | null> {
    const registryInfo = await this.getRegistryInfo(registry)
    if (this._installedPlugins.has(`${registry}:${id}`)) {
      return (await this._installedPlugins.get(`${registry}:${id}`)) ?? null
    }
    const scope = this._installOneByRegistryInfo(registryInfo, id)
    this._installedPlugins.set(`${registry}:${id}`, scope)
    return await scope
  }
  async uninstall(registry: string, id: string): Promise<boolean> {
    const promise = this._installedPlugins.get(`${registry}:${id}`)
    if (promise === void 0) {
      return true // not installed or already uninstalled
    }
    this._installedPlugins.delete(`${registry}:${id}`)
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

  private async _installOneByRegistryInfo(
    registryInfo: PluginStoreRegistry,
    id: string
  ): Promise<ForkScope<InPageEdit> | null> {
    const baseUrl = registryInfo.base_url
    const pkg = registryInfo.packages.find((p) => p.id === id)
    if (!pkg) {
      this.ctx.logger.warn(`Package ${id} not found in registry ${baseUrl}`)
      return null
    }
    const loader = pkg.loader
    const { kind, entry = 'index.js', styles = [], main_export = null } = loader
    const entryUrl = kind === 'styles' ? null : new URL(entry, baseUrl).href

    if (kind !== 'styles' && !entryUrl) {
      this.ctx.logger.warn(`Entry file ${entry} not found in registry ${baseUrl}`)
      return null
    }

    const datasets = {
      'data-plugin-store': baseUrl,
      'data-plugin-package': JSON.stringify(pkg),
    }

    let fork: ForkScope<InPageEdit> | null = null

    switch (kind) {
      case 'autoload': {
        fork = this.ctx.plugin({
          inject: ['resourceLoader'],
          name: `plugin-store-${baseUrl}-${id}`,
          apply(ctx) {
            ctx.resourceLoader.loadScript(entryUrl!, { ...datasets })
          },
        })
        break
      }
      case 'module': {
        const apply = await import(/* @vite-ignore */ entryUrl!).then(
          (m) => m[main_export!] ?? m['default'] ?? m
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
          await this.ctx.resourceLoader.loadScript(entryUrl!, { ...datasets })
          apply = tryGetGlobalPlugin(main_export!)
        }
        if (!apply) {
          this.ctx.logger.warn(`Main export ${main_export} not found in globalThis`)
          return null
        }
        fork = this.ctx.plugin(apply)
        break
      }
    }

    if (styles && styles.length > 0) {
      const urls = styles.map((u) => new URL(u, baseUrl).href).filter(Boolean)
      // ensure plugin fork scope
      fork ||= this.ctx.plugin({
        name: `plugin-store-${baseUrl}-${id}`,
        apply() {},
      })
      // register sub plugin for styles
      fork.ctx.plugin({
        inject: ['resourceLoader'],
        name: `plugin-store-${baseUrl}-${id}-styles`,
        apply(ctx) {
          urls.map((u) => ctx.resourceLoader.loadStyle(u, { ...datasets }))
          ctx.on('dispose', () => {
            console.info('parent disposed, removing styles', urls)
            urls.forEach((u) => ctx.resourceLoader.removeStyle(u))
          })
        },
      })
    }

    return fork
  }

  validateRegistry(data: any): PluginStoreRegistry {
    return PluginStoreSchemas.Registry(data)
  }
  async getRegistryInfo(registry: string): Promise<PluginStoreRegistry> {
    const cached = await this.getRegistryCache(registry)
    if (cached) {
      return cached
    }
    const data = await this.fetchOnlineRegistryInfo(registry)
    await this.setRegistryCache(registry, data)
    return data
  }
  private async fetchOnlineRegistryInfo(registry: string): Promise<PluginStoreRegistry> {
    const response = await fetch(registry)
    const data = await response.json()
    const validated = this.validateRegistry(data)
    return validated
  }
  private async getRegistryCache(registry: string) {
    const data = await this.registryCacheDB.get(registry)
    if (data) {
      try {
        const validated = this.validateRegistry(data)
        return validated
      } catch (e) {
        this.ctx.logger.warn('Invalid cached registry', e, data)
        this.registryCacheDB.delete(registry)
      }
    }
    return null
  }
  private async setRegistryCache(registry: string, data: PluginStoreRegistry) {
    return this.registryCacheDB.set(registry, data)
  }
}
