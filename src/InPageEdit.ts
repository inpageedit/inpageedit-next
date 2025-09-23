import { Context, Inject, Schema } from 'cordis'
import { ApiService } from '@/services/ApiService'
import { ResourceLoaderService } from '@/services/ResourceLoaderService'
import { SsiModalService } from '@/services/SsiModalService'
import { StorageService } from '@/services/StorageService'
import { SiteMetadataService } from '@/services/SiteMetadataService'
import { WikiPageService } from '@/services/WikiPageService'

export interface InPageEditCoreConfig {
  legacyPreferences: Record<string, any>
  baseURL: string | URL
}

export * from 'cordis'

/**
 * ✏️ InPageEdit NEXT
 *
 * 🚀 Modular, Extensible Supercharged Plugin for MediaWiki
 *
 * @author dragon-fish <dragon-fish@qq.com>
 * @license MIT
 * @see https://github.com/Dragon-Fish/InPageEdit-v2
 */
@RegisterPreferences(
  Schema.object({
    test: Schema.string().description('test description'),
  })
    .description('App configs')
    .extra('category', 'general'),
  {
    test: 'foo bar baz',
  }
)
export class InPageEdit extends Context {
  public config: InPageEditCoreConfig
  static DEFAULT_CONFIG: InPageEditCoreConfig = {
    legacyPreferences: {},
    baseURL: '',
  }
  Endpoints = Endpoints
  Schema = Schema
  readonly version: string = import.meta.env.__VERSION__ || '0.0.0'

  constructor(config?: Partial<InPageEditCoreConfig>) {
    super()
    this.config = {
      ...InPageEdit.DEFAULT_CONFIG,
      ...config,
    }

    this.#initCoreServices()
    this.#initCorePlugins()
    this.#initCoreAssets()
  }

  async #initCoreServices() {
    this.plugin(ApiService, { baseURL: this.config.baseURL })
    this.plugin(ResourceLoaderService)
    this.plugin(SsiModalService)
    this.plugin(StorageService)
    this.plugin(SiteMetadataService)
    this.plugin(WikiPageService)
  }

  // TODO: 这里不应该硬编码，暂时先这样
  async #initCorePlugins() {
    const plugins = [
      import('@/plugins/preferences/index.js').then(({ PluginPreferences }) => PluginPreferences),
      import('@/plugins/quick-edit/index.js').then(({ PluginQuickEdit }) => PluginQuickEdit),
      import('@/plugins/quick-move/index.js').then(({ PluginQuickMove }) => PluginQuickMove),
      import('@/plugins/quick-preview/index.js').then(
        ({ PluginQuickPreview }) => PluginQuickPreview
      ),
      import('@/plugins/quick-diff/index.js').then(({ PluginQuickDiff }) => PluginQuickDiff),
      import('@/plugins/quick-redirect/index.js').then(
        ({ PluginQuickRedirect }) => PluginQuickRedirect
      ),
      import('@/plugins/toolbox/index.js').then(({ PluginToolbox }) => PluginToolbox),
    ]
    plugins.forEach(async (plugin) => {
      this.plugin(await plugin)
    })
  }

  // TODO: 应该抽象到 PluginTheme 中去，暂时先硬编码
  async #initCoreAssets() {
    this.inject(['resourceLoader'], (ctx) => {
      import.meta.env.PROD && ctx.resourceLoader.loadStyle(import.meta.resolve('./style.css'))
      ctx.resourceLoader.loadStyle(`${Endpoints.PLUGIN_CDN_BASE}/skins/ipe-default.css`)
    })
  }

  async useScope(inject: Inject) {
    const { promise, resolve } = promiseWithResolvers<this>()
    this.inject(inject, (ctx) => {
      resolve(ctx)
    })
    return promise
  }
}
