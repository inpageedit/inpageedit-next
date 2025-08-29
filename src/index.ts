import '@/polyfills'
import { InPageEdit as Core } from '@/InPageEdit'
export { InPageEdit } from '@/InPageEdit'
export { default as BasePlugin } from '@/plugins/BasePlugin'

// IIFE
;((window as any).RLQ ||= []).push([['mediawiki.base'], autoload])

async function autoload() {
  // 防止多次运行
  if (window?.InPageEdit?.stop) {
    await window.InPageEdit.stop()
  }

  window.InPageEditCore = Core

  const oldGlobalVar: any = window.InPageEdit || {}
  const ipe = new Core({
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

  window.InPageEdit = ipe
}

/**
 * Global variable declaration
 *
 * Due to historical problem,
 * we call the IPE instance `InPageEdit`,
 * and the IPE class called `InPageEditCore`
 */
declare global {
  export const InPageEditCore: typeof Core
  export const InPageEdit: Core
  export interface Window {
    InPageEditCore: typeof Core
    InPageEdit: Core
    __IPE_MODULES__: {
      push: (payload: (ipe: Core) => void) => void
    }
  }
}

/**
 * FIXME: 热重载似乎有点问题，需要 vite 大神协助修复
 * 目前暂时回退到刷新网页
 *
 * console > GET http://localhost:1005/src/index.js.ts?t=1756407659107 net::ERR_ABORTED 404 (Not Found)
 * console > [vite] Failed to reload /src/index.js.ts. This could be due to syntax errors or importing non-existent modules. (see errors above)
 *
 */
if (import.meta.hot) {
  // import.meta.hot.dispose(async () => {
  //   if (window.InPageEdit) {
  //     console.info('[InPageEdit] Clean up for hot reload')
  //     await window?.InPageEdit?.stop?.()
  //     window.InPageEdit = undefined as any
  //   }
  // })
  // import.meta.hot.accept((module) => {
  //   if (typeof module === 'undefined') {
  //     console.error("[InPageEdit] Hell no, I'm so cold...")
  //     location.reload()
  //   } else {
  //     console.info("[InPageEdit] OMG, I'm so hot!", module)
  //     autoload()
  //   }
  // })
  import.meta.hot.accept(() => {
    console.error("[InPageEdit] OMG, I'm so hot!")
    location.reload()
  })
}
