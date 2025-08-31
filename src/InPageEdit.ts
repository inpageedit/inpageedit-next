import { Context } from 'cordis'
import { ApiService } from '@/services/ApiService'
import { ResourceLoaderService } from '@/services/ResourceLoaderService'
import { SsiModalService } from '@/services/SsiModalService'
import { StorageService } from '@/services/StorageService'
import { SiteMetadataService } from '@/services/SiteMetadataService'
import { WikiPageService } from '@/services/WikiPageService'

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
    this.plugin(StorageService)
    this.plugin(SiteMetadataService)
    this.plugin(WikiPageService)
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

  static async autoload() {
    // 防止多次运行
    if ((window as any)?.IPE?.stop) {
      console.warn('[InPageEdit] Plugin already loaded, disposing...')
      await window.ipe.stop()
    }

    const oldGlobalVar: any = window.InPageEdit || {}
    const ipe = new InPageEdit({
      legacyPreferences: oldGlobalVar?.myPreferences || {},
    })
    ipe.start().then(() => {
      // Trigger MediaWiki js hook
      mw?.hook?.('InPageEdit.ready').fire(ipe)

      // Initialize global modules
      window.__IPE_MODULES__ ||= [] as any[]
      if (Array.isArray(window.__IPE_MODULES__)) {
        const modulesBackup = [] as any[]
        while (window.__IPE_MODULES__.length) {
          try {
            const payload = window.__IPE_MODULES__.shift()
            typeof payload === 'function' && payload?.(ipe)
            modulesBackup.push(payload)
          } catch (error) {
            console.error('[InPageEdit] Failed to initialize module:', error)
          }
        }
        window.__IPE_MODULES__ = {
          push: (payload) => {
            typeof payload === 'function' && payload(ipe)
            modulesBackup.push(payload)
          },
        }
        ipe.on('dispose', () => {
          window.__IPE_MODULES__ = modulesBackup
        })
      }

      // 花里胡哨的加载提示
      ipe
        .logger('READY')
        .info(
          `${Endpoints.HOME_URL}` +
            '\n' +
            '    ____      ____                   ______    ___ __ \n   /  _/___  / __ \\____ _____ ____  / ____/___/ (_) /_\n   / // __ \\/ /_/ / __ `/ __ `/ _ \\/ __/ / __  / / __/\n _/ // / / / ____/ /_/ / /_/ /  __/ /___/ /_/ / / /_  \n/___/_/ /_/_/    \\__,_/\\__, /\\___/_____/\\__,_/_/\\__/  \n                      /____/                v' +
            import.meta.env.__VERSION__
        )
    })

    window.InPageEdit = InPageEdit
    window.ipe = ipe
  }
}

/**
 * Global types declaration
 */
declare global {
  export interface Window {
    InPageEdit: typeof InPageEdit
    ipe: InPageEdit
    __IPE_MODULES__: {
      push: (payload: (ipe: InPageEdit) => void) => void
    }
  }
}
