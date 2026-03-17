export type ThemeMode = 'light' | 'dark'

export interface SiteThemeAdapter {
  /** Display name, e.g. "Fandom", "Vector 2022" */
  name: string
  /** Whether this adapter can handle the current page */
  match(): boolean
  /** Get current site theme */
  getCurrentTheme(): ThemeMode
  /** Start observing site theme changes, call onChange when theme changes */
  startObserving(onChange: () => void): void
  /** Stop observing */
  stopObserving(): void
}

export interface ClassBasedAdapterConfig {
  name: string
  /** CSS class names on html/body that indicate this skin is active */
  skinClasses: string[]
  /** CSS class names that indicate dark mode */
  darkClasses: string[]
  /** CSS class names that indicate "follow system preference" mode */
  systemClasses?: string[]
  /** Which element(s) to check for darkClasses/systemClasses. Default: 'both' */
  target?: 'body' | 'html' | 'both'
}

function getTargetElements(target: 'body' | 'html' | 'both'): Element[] {
  if (target === 'html') return [document.documentElement]
  if (target === 'body') return [document.body]
  return [document.documentElement, document.body]
}

function hasAnyClass(elements: Element[], classNames: string[]): boolean {
  return elements.some((el) => classNames.some((cls) => el.classList.contains(cls)))
}

export function createClassBasedAdapter(config: ClassBasedAdapterConfig): SiteThemeAdapter {
  const target = config.target ?? 'both'
  const systemClasses = config.systemClasses ?? []
  let observer: MutationObserver | null = null
  let mediaQuery: MediaQueryList | null = null
  let mediaQueryHandler: (() => void) | null = null

  return {
    name: config.name,

    match(): boolean {
      // skinClasses are checked on both html and body regardless of target
      return hasAnyClass([document.documentElement, document.body], config.skinClasses)
    },

    getCurrentTheme(): ThemeMode {
      const elements = getTargetElements(target)
      if (hasAnyClass(elements, config.darkClasses)) return 'dark'
      if (systemClasses.length > 0 && hasAnyClass(elements, systemClasses)) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      }
      return 'light'
    },

    startObserving(onChange: () => void): void {
      // Reuse existing observer if already active
      if (observer) return

      observer = new MutationObserver(onChange)
      for (const el of getTargetElements(target)) {
        observer.observe(el, { attributes: true, attributeFilter: ['class'] })
      }
      if (systemClasses.length > 0) {
        mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        mediaQueryHandler = onChange
        mediaQuery.addEventListener('change', mediaQueryHandler)
      }
    },

    stopObserving(): void {
      observer?.disconnect()
      observer = null
      if (mediaQuery && mediaQueryHandler) {
        mediaQuery.removeEventListener('change', mediaQueryHandler)
        mediaQuery = null
        mediaQueryHandler = null
      }
    },
  }
}

/** Built-in site theme adapters, ordered by specificity. */
export const BUILTIN_SITE_ADAPTERS: ClassBasedAdapterConfig[] = [
  {
    name: 'MoeSkin',
    skinClasses: ['skin-moeskin'],
    darkClasses: ['dark'],
    target: 'html',
  },
  {
    name: 'Fandom Desktop',
    skinClasses: ['skin-fandomdesktop'],
    darkClasses: ['theme-fandomdesktop-dark'],
  },
  {
    name: 'Fandom Mobile',
    skinClasses: ['skin-fandommobile'],
    darkClasses: ['theme-fandommobile-dark'],
  },
  {
    name: 'Vector 2022',
    skinClasses: ['skin-vector-2022'],
    darkClasses: ['skin-theme-clientpref-night'],
    systemClasses: ['skin-theme-clientpref-os'],
    target: 'html',
  },
  {
    name: 'Citizen',
    skinClasses: ['skin-citizen'],
    darkClasses: ['skin-theme-clientpref-night'],
    systemClasses: ['skin-theme-clientpref-os'],
    target: 'html',
  },
]
