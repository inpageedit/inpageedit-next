import { InPageEdit, Service } from '@/InPageEdit'

declare module '@/InPageEdit' {
  interface InPageEdit {
    resourceLoader: ResourceLoaderService
  }
}

export class ResourceLoaderService extends Service {
  constructor(public ctx: InPageEdit) {
    super(ctx, 'resourceLoader', true)
  }
  protected stop(): void | Promise<void> {
    this.removeAll()
  }

  loadScript(src: string, attrs?: Record<string, any>): Promise<HTMLScriptElement | null> {
    if (!src) {
      return Promise.resolve(null)
    }
    const key = `script:${src}`
    const existed = document.querySelector(`[data-ipe="${key}"]`)
    if (existed) {
      return Promise.resolve(existed as HTMLScriptElement)
    }
    const promise = new Promise<HTMLScriptElement>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = src
      script.dataset.ipe = key
      if (attrs) {
        Object.entries(attrs).forEach(([key, value]) => {
          if (typeof value === 'undefined' || value === false || value === null) {
            script.removeAttribute(key)
          } else {
            script.setAttribute(key, value)
          }
        })
      }
      document.body.appendChild(script)
      script.onload = () => resolve(script)
      script.onerror = (e) => reject(e)
    })
    return promise
  }

  loadStyle(href: string, attrs?: Record<string, any>): Promise<HTMLLinkElement | null> {
    if (!href) {
      return Promise.resolve(null)
    }
    const key = `style:${href}`
    const existed = document.querySelector(`[data-ipe="${key}"]`)
    if (existed) {
      return Promise.resolve(existed as HTMLLinkElement)
    }
    const promise = new Promise<HTMLLinkElement>((resolve, reject) => {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = href
      link.dataset.ipe = key
      if (attrs) {
        Object.entries(attrs).forEach(([key, value]) => {
          if (typeof value === 'undefined' || value === false || value === null) {
            link.removeAttribute(key)
          } else {
            link.setAttribute(key, value)
          }
        })
      }
      const meta =
        document.querySelector('meta[name="ipe-styles"]') ||
        (() => {
          const meta = document.createElement('meta')
          meta.id = 'ipe-styles'
          meta.name = 'ipe-styles'
          document.head.insertAdjacentElement('afterbegin', meta)
          return meta
        })()
      meta.before(link)
      link.onload = () => resolve(link)
      link.onerror = (e) => reject(e)
    })
    return promise
  }

  removeStyle(href: string) {
    const key = `style:${href}`
    const link = document.querySelector(`[data-ipe="${key}"]`)
    if (link) {
      link.remove()
    }
  }
  removeScript(src: string) {
    const key = `script:${src}`
    const script = document.querySelector(`[data-ipe="${key}"]`)
    if (script) {
      script.remove()
    }
  }
  removeAll() {
    document.querySelectorAll('[data-ipe]').forEach((el) => {
      el.remove()
    })
  }

  resolveImportPath(path: string) {
    if (path.startsWith('http') || path.startsWith('//')) {
      return path
    }
    if (import.meta.env.VITE_BUILD_FORMAT === 'import') {
      return import.meta.resolve(path)
    }
    const src = (document.currentScript as HTMLScriptElement)?.src
    if (!src) {
      return `https://unpkg.com/mediawiki-inpageedit@latest/dist/${path}`
    }
    const url = new URL(src)
    if (!url.pathname.endsWith('.js')) {
      url.pathname = url.pathname + '/'
    }
    return new URL(path, url.toString()).toString()
  }
}
