import '@/polyfills'
import { InPageEdit as IPECore } from '@/InPageEdit'
import { Endpoints } from './constants/endpoints.js'

export * from '@/InPageEdit'
export { default as BasePlugin } from '@/plugins/BasePlugin'

// Safe guard
window.RLQ ||= []
window.__IPE_MODULES__ ||= []

// Auto load if the site is MediaWiki
runOnce('InPageEdit#autoload', () => {
  const isMediaWiki =
    document.querySelector('meta[name="generator"][content^="MediaWiki"]') !== null
  const apiBase = document
    .querySelector<HTMLLinkElement>('link[rel="EditURI"]')
    ?.href?.split('?')[0]
  if (isMediaWiki && apiBase) {
    autoload(apiBase)
  }
})
async function autoload(baseURL: string) {
  // 防止多次运行
  if (typeof window?.ipe?.stop === 'function') {
    console.warn('[InPageEdit] Plugin already loaded, disposing...')
    await window.ipe.stop()
  }

  const oldGlobalVar: any = window.InPageEdit || {}
  const ipe = new IPECore({
    apiConfigs: {
      baseURL,
    },
    legacyPreferences: oldGlobalVar?.myPreferences || {},
  })

  // Merge into global variables
  window.InPageEdit = IPECore
  window.ipe = ipe

  // Start the App
  await ipe.start()

  // Trigger the mw.hook
  window.RLQ.push(() => {
    mw.hook('InPageEdit.ready').fire(ipe)
  })

  // Initialize global modules
  if (Array.isArray(window.__IPE_MODULES__)) {
    const installedModules = [] as any[]
    while (window.__IPE_MODULES__.length) {
      try {
        const payload = window.__IPE_MODULES__.shift()
        typeof payload === 'function' && payload?.(ipe)
        installedModules.push(payload)
      } catch (error) {
        console.error('[InPageEdit] Failed to initialize module:', error)
      }
    }
    window.__IPE_MODULES__ = {
      push: (payload) => {
        typeof payload === 'function' && payload(ipe)
        installedModules.push(payload)
      },
    }
    ipe.on('dispose', () => {
      window.__IPE_MODULES__ = installedModules
    })
  }

  // 花里胡哨的加载提示
  ipe.logger('AUTOLOAD').info(
    '\n' +
      '    ____      ____                   ______    ___ __ \n   /  _/___  / __ \\____ _____ ____  / ____/___/ (_) /_\n   / // __ \\/ /_/ / __ `/ __ `/ _ \\/ __/ / __  / / __/\n _/ // / / / ____/ /_/ / /_/ /  __/ /___/ /_/ / / /_  \n/___/_/ /_/_/    \\__,_/\\__, /\\___/_____/\\__,_/_/\\__/  \n                      /____/                v' +
      ipe.version +
      '\n' +
      Object.entries({
        'Wiki API Base': baseURL,
        'Document Site': Endpoints.HOME_URL,
        'Bug reporting': Endpoints.GITHUB_URL,
      })
        .map(([key, value]) => `- ${key}: ${value}`)
        .join('\n')
  )
}

function runOnce(key: string, fn: Function) {
  const sym = Symbol.for(key)
  if ((window as any)[sym]) {
    return false
  }
  ;(window as any)[sym] = true
  fn()
  return true
}

// Global types declaration
declare global {
  const InPageEdit: typeof IPECore
  const ipe: IPECore
  interface Window {
    InPageEdit: typeof IPECore
    ipe: IPECore
    __IPE_MODULES__: {
      push(payload: (ipe: IPECore) => void): void
    }
  }
}

// MediaWiki ResourceLoader Queue
declare global {
  interface Window {
    RLQ: {
      push(callback: () => void): void
      push(depAndCallback: [string, () => void]): void
      push(depsAndCallback: [string[], () => void]): void
    }
  }
}

// declare mw.hook
declare global {
  namespace mw {
    /**
     * @see https://doc.wikimedia.org/mediawiki-core/master/js/Hook.html
     * @see https://github.com/wikimedia-gadgets/types-mediawiki/blob/9b4e7c3b9034d64a44a0667229a6d9585fe09b30/mw/hook.d.ts
     */
    interface Hook<T extends any[] = any[]> {
      add(...handler: Array<(...data: T) => any>): this
      deprecate(msg: string): this
      fire(...data: T): this
      remove(...handler: Array<(...data: T) => any>): this
    }
    function hook(name: 'InPageEdit.ready'): Hook<[IPECore]>
  }
}
