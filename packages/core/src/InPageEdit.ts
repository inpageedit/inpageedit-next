import { Context, Inject, Events as CordisEvents } from '@cordisjs/core'
import Schema from 'schemastery'
import { LoggerLevel, createLogger, type Logger } from '@inpageedit/logger'
import { ApiService } from '@/services/ApiService.js'
import { ResourceLoaderService } from '@/services/ResourceLoaderService.js'
import { ModalService } from '@/services/ModalService.js'
import { WikiMetadataService } from '@/services/WikiMetadataService.js'
import { StorageService } from '@/services/StorageService.js'
import { WikiPageService } from '@/services/WikiPageService.js'
import { WikiTitleService } from '@/services/WikiTitleService.js'
import '@/styles/index.scss'
import { FexiosConfigs } from 'fexios'

export interface InPageEditCoreConfig {
  apiConfigs: Partial<FexiosConfigs>
  legacyPreferences: Record<string, any>
  logLevel: number
  autoloadStyles: boolean
}

/**
 * ✏️ InPageEdit NEXT
 *
 * 🚀 Modular, Extensible Supercharged Plugin for MediaWiki
 *
 * @author dragon-fish <dragon-fish@qq.com>
 * @license MIT
 * @see https://github.com/inpageedit/inpageedit-next
 * @see https://www.ipe.wiki/
 */
export class InPageEdit extends Context {
  readonly version: string = import.meta.env.__VERSION__ || '0.0.0'

  public config: InPageEditCoreConfig
  static DEFAULT_CONFIG: InPageEditCoreConfig = {
    apiConfigs: {},
    legacyPreferences: {},
    logLevel: import.meta.env.DEV ? LoggerLevel.debug : LoggerLevel.info,
    autoloadStyles: true,
  }
  Endpoints = Endpoints
  readonly schema = Schema
  readonly logger: Logger

  constructor(config?: Partial<InPageEditCoreConfig>) {
    super({
      name: 'InPageEdit',
    })
    this.config = {
      ...InPageEdit.DEFAULT_CONFIG,
      ...config,
    }
    this.logger = createLogger({
      name: 'IPE',
      color: '#33aaff',
      level: this.config.logLevel,
    })
    this.#initCoreServices()
    this.#initCorePlugins()
    this.#initCoreAssets()
  }

  async #initCoreServices() {
    this.plugin(ApiService, this.config.apiConfigs)
    this.plugin(ResourceLoaderService)
    this.plugin(ModalService)
    this.plugin(StorageService)
    this.plugin(WikiMetadataService)
    this.plugin(WikiPageService)
    this.plugin(WikiTitleService)

    // 标记内置服务，所以用户即使忘记 inject 也能使用
    this.#markServiceAsBuiltIn([
      'api',
      'resourceLoader',
      'modal',
      'storage',
      'wikiPage',
      'wikiTitle',
      // WikiMetadataService
      'wiki',
      'getUrl',
      'getSciprtUrl',
      'getMainpageUrl',
    ])
  }

  #markServiceAsBuiltIn(services: string | string[]) {
    if (typeof services === 'string') {
      services = [services]
    }
    if (!Array.isArray(services) || services.length === 0) return this
    for (const name of services) {
      const internal = this[InPageEdit.internal][name]
      if (internal?.type === 'service') {
        internal.builtin = true
      }
    }
    return this
  }

  // TODO: 这里不应该硬编码，暂时先这样
  async #initCorePlugins() {
    const plugins = [
      import('@/plugins/in-article-links/index.js').then(
        ({ PluginInArticleLinks }) => PluginInArticleLinks
      ),
      import('@/plugins/preferences/index.js').then(({ PluginPreferences }) => PluginPreferences),
      import('@/plugins/quick-edit/index.js').then(({ PluginQuickEdit }) => PluginQuickEdit),
      import('@/plugins/quick-delete/index.js').then(({ PluginQuickDelete }) => PluginQuickDelete),
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

    if (import.meta.env.DEV) {
      this.plugin((await import('@/plugins/_debug/index.js')).default)
    }
  }

  // TODO: 应该抽象到 PluginTheme 中去，暂时先硬编码
  async #initCoreAssets() {
    this.inject(['resourceLoader'], (ctx) => {
      if (
        import.meta.env.PROD &&
        import.meta.env.VITE_BUILD_FORMAT === 'import' &&
        this.config.autoloadStyles
      ) {
        ctx.resourceLoader.loadStyle(import.meta.resolve('./style.css'))
      }
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

// 导出依赖包以便用户使用
export { default as Schema } from 'schemastery'
export * from '@inpageedit/logger'

// 类型体操
export { Inject, Service } from '@cordisjs/core'
export interface Events<C extends InPageEdit = InPageEdit> extends CordisEvents<C> {}
export interface InPageEdit {
  [InPageEdit.events]: Events<this>
}
