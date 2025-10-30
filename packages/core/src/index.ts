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
  const baseURL = detectMediaWikiApiEndpoint()
  if (baseURL) {
    autoload({
      baseURL,
      CoreClass: IPECore,
    })
  }
})
async function autoload(
  _overload: {
    baseURL?: string
    CoreClass: typeof IPECore
  } = { baseURL: detectMediaWikiApiEndpoint(), CoreClass: IPECore }
) {
  const { baseURL, CoreClass: IPE } = _overload

  // 防止多次运行
  if (typeof window?.ipe?.stop === 'function') {
    console.warn('[InPageEdit] Already loaded, disposing...')
    await window.ipe.stop()
  }

  const oldGlobalVar: any = window.InPageEdit || {}
  const ipe = new IPE({
    apiConfigs: {
      baseURL,
    },
    legacyPreferences: oldGlobalVar?.myPreferences || {},
  })

  // Merge into global variables
  window.InPageEdit = IPE
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
      `
- Wiki API Endpoint: ${baseURL}
- Documentation:     ${Endpoints.HOME_URL}
- Bug Reports:       ${Endpoints.GITHUB_URL}`
  )
}

function detectMediaWikiApiEndpoint(): string | undefined {
  const isMediaWiki =
    document.querySelector('meta[name="generator"][content^="MediaWiki"]') !== null
  const apiBase = document
    .querySelector<HTMLLinkElement>('link[rel="EditURI"]')
    ?.href?.split('?')[0]
  return isMediaWiki && apiBase ? apiBase : undefined
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

// HMR
if (import.meta.hot) {
  const SEPARATOR = `\n${'='.repeat(20)} [InPageEdit] HMR ${'='.repeat(20)}\n`
  import.meta.hot.accept(async (modules) => {
    const apiBase = detectMediaWikiApiEndpoint()!
    const IPE = modules?.InPageEdit as unknown as typeof IPECore
    if (!apiBase || !IPE) {
      console.warn(SEPARATOR.trimStart(), 'missing modules', SEPARATOR.trimEnd())
      location.reload()
      return
    }

    console.info(SEPARATOR.trimStart(), "I'm so hot!", modules, SEPARATOR.trimEnd())
    await window?.ipe?.stop()
    window.ipe = undefined as any
    window.InPageEdit = undefined as any
    autoload({
      baseURL: apiBase,
      CoreClass: IPE,
    })
  })
}
