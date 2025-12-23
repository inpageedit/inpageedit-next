import { Context, Inject } from '@cordisjs/core'
import Schema from 'schemastery'
import { LoggerLevel, createLogger, type Logger } from '@inpageedit/logger'
import { deepMerge, FexiosConfigs } from 'wiki-saikou'
import { ApiService } from '@/services/ApiService.js'
import { CurrentPageService } from '@/services/CurrentPageService'
import { ResourceLoaderService } from '@/services/ResourceLoaderService.js'
import { ModalService } from '@/services/ModalService.js'
import { WikiMetadataService } from '@/services/WikiMetadataService.js'
import { StorageService } from '@/services/storage/index.js'
import { ThemeService } from '@/services/ThemeService.js'
import { WikiPageService } from '@/services/WikiPageService.js'
import { WikiTitleService } from '@/services/WikiTitleService.js'
import '@/styles/index.scss'
import { PreferencesService } from './services/PreferencesService'

export interface InPageEditCoreConfig {
  apiConfigs: Partial<FexiosConfigs>
  legacyPreferences: Record<string, any>
  logLevel: number
  storageNamespace: string
  autoloadStyles: boolean
  autoInstallCorePlugins: boolean
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
    storageNamespace: 'InPageEdit',
    autoloadStyles: true,
    autoInstallCorePlugins: true,
  }
  Endpoints = Endpoints
  readonly schema = Schema
  readonly logger: Logger

  constructor(config?: Partial<InPageEditCoreConfig>) {
    super({
      name: 'InPageEdit',
    })
    this.config = deepMerge(InPageEdit.DEFAULT_CONFIG, config)
    this.logger = createLogger({
      name: 'IPE',
      color: '#33aaff',
      level: this.config.logLevel,
    })
    this.#init()
  }

  async #init() {
    await this.#initCoreServices()
    if (this.config.autoInstallCorePlugins) {
      this.#initCorePlugins()
    }
    this.#initCoreAssets()
  }

  async #initCoreServices() {
    this.plugin(I18nService)
    this.plugin(ApiService, this.config.apiConfigs)
    this.plugin(CurrentPageService)
    this.plugin(ResourceLoaderService)
    this.plugin(ModalService)
    this.plugin(PreferencesService)
    this.plugin(StorageService, { dbName: this.config.storageNamespace })
    this.plugin(ThemeService)
    this.plugin(WikiFileService)
    this.plugin(WikiMetadataService)
    this.plugin(WikiPageService)
    this.plugin(WikiTitleService)

    // 标记内置服务，所以用户即使忘记 inject 也能使用
    this.#markServiceAsBuiltIn([
      'i18n',
      '$',
      '$$',
      'api',
      'currentPage',
      'resourceLoader',
      'modal',
      'preferences',
      'storage',
      'theme',
      'wikiPage',
      'wikiTitle',
      // WikiMetadataService
      'wiki',
      'getUrl',
      'getSciprtUrl',
      'getMainpageUrl',
    ])
  }

  #markServiceAsBuiltIn(services: string[]) {
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
      import('@/plugins/analytics/index.js').then(({ PluginAnalytics }) => PluginAnalytics),
      import('@/plugins/in-article-links/index.js').then(
        ({ PluginInArticleLinks }) => PluginInArticleLinks
      ),
      import('@/plugins/plugin-store/index.js').then(({ PluginPluginStore }) => PluginPluginStore),
      import('@/plugins/preferences-ui/index.js').then(
        ({ PluginPreferencesUI }) => PluginPreferencesUI
      ),
      import('@/plugins/quick-edit/index.js').then(({ PluginQuickEdit }) => PluginQuickEdit),
      import('@/plugins/quick-move/index.js').then(({ PluginQuickMove }) => PluginQuickMove),
      import('@/plugins/quick-preview/index.js').then(
        ({ PluginQuickPreview }) => PluginQuickPreview
      ),
      import('@/plugins/quick-diff/index.js').then(({ PluginQuickDiff }) => PluginQuickDiff),
      import('@/plugins/quick-redirect/index.js').then(
        ({ PluginQuickRedirect }) => PluginQuickRedirect
      ),
      import('@/plugins/quick-upload/index.js').then(({ PluginQuickUpload }) => PluginQuickUpload),
      import('@/plugins/quick-usage/index.js').then(({ PluginQuickUsage }) => PluginQuickUsage),
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

  async withInject(inject: Inject) {
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
export interface PreferencesMap {}

// 类型体操
export {
  Inject,
  EffectScope,
  ForkScope,
  MainScope,
  ScopeStatus,
  symbols as CordisSymbols,
  Service,
  CordisError,
  Lifecycle,
} from '@cordisjs/core'
import {
  Events as CordisEvents,
  Plugin as CordisPlugin,
  Registry as CordisRegistry,
} from '@cordisjs/core'
import { I18nService } from './services/i18n/index.js'
import { WikiFileService } from './services/WikiFileService.js'
export interface Events<C extends InPageEdit = InPageEdit> extends CordisEvents<C> {}
export type IPEPlugin<C = any> = CordisPlugin<InPageEdit, C>
export type IPERegistry = CordisRegistry<InPageEdit>
export interface InPageEdit {
  [InPageEdit.events]: Events<this>
}
