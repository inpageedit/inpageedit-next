import '@/polyfills'
import { InPageEdit as IPECore } from '@/InPageEdit'

export { InPageEdit, Service, Schema } from '@/InPageEdit'
export { default as BasePlugin } from '@/plugins/BasePlugin'

// IIFE
;((window as any).RLQ ||= []).push([['mediawiki.base'], IPECore.autoload])

/**
 * Hot Module Replacement (HMR) support
 */
if (import.meta.hot) {
  import.meta.hot.accept((module) => {
    if (typeof module === 'undefined') {
      console.error("[InPageEdit] Hell no, I'm so cold...")
      location.reload()
    } else {
      console.info("[InPageEdit] OMG, I'm so hot!", module)
      IPECore.autoload()
    }
  })
}

declare global {
  const InPageEdit: typeof IPECore
  const ipe: IPECore
}
