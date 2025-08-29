import { Context } from 'cordis'
import { ApiService } from './services/ApiService'
import { ResourceLoaderService } from './services/ResourceLoaderService'
import { SsiModalService } from './services/SsiModalService'

export interface InPageEditCoreConfig {
  legacyPreferences: Record<string, any>
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
export class InPageEdit extends Context {
  public config: InPageEditCoreConfig
  static DEFAULT_CONFIG: InPageEditCoreConfig = {
    legacyPreferences: {},
  }
  Endpoints = Endpoints

  constructor(config?: Partial<InPageEditCoreConfig>) {
    super()
    this.config = {
      ...InPageEdit.DEFAULT_CONFIG,
      ...config,
    }
    this.installCoreServices()
    this.installCoreModules()
    this.loadCoreAssets()
  }

  private async installCoreServices() {
    this.plugin(ApiService)
    this.plugin(ResourceLoaderService)
    this.plugin(SsiModalService)
    this.plugin((await import('@/services/SiteMetadataService')).SiteMetadataService)
    this.plugin((await import('@/services/WikiPageService')).WikiPageService)
  }

  private async installCoreModules() {
    this.plugin((await import('@/plugins/toolbox/index')).PluginToolbox)
    this.plugin((await import('@/plugins/quick-edit/index')).PluginQuickEdit)
    this.plugin((await import('@/plugins/quick-preview/index')).PluginQuickPreview)
    this.plugin((await import('@/plugins/quick-diff/index')).PluginQuickDiff)
    this.plugin((await import('@/plugins/quick-rename/index')).PluginQuickRename)
  }

  private async loadCoreAssets() {
    // TODO: 应该抽象到 PluginTheme 中去，暂时先硬编码
    this.inject(['resourceLoader'], (ctx) => {
      import.meta.env.PROD && ctx.resourceLoader.loadStyle(import.meta.resolve('./style.css'))
      ctx.resourceLoader.loadStyle(`${Endpoints.PLUGIN_CDN_BASE}/skins/ipe-default.css`)
    })
  }

  private _resolveLegacyGlobalConfigs() {
    const globalObj = (window as any).InPageEdit || {}

    // 偏好设置
    const myPreferences = globalObj?.myPreferences || {}
  }
}
