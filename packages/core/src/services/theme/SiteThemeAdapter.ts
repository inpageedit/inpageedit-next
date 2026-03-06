export type ThemeMode = 'light' | 'dark'

export interface SiteThemeAdapter {
  /** Display name, e.g. "Fandom", "Vector2022" */
  name: string
  /** Whether this adapter can handle the current page (check hostname, DOM, etc.) */
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
  /** Glob patterns to match hostname, e.g. '*.fandom.com' */
  hostnamePatterns?: string[]
  /**
   * CSS class names on html/body that indicate this adapter should activate.
   * Useful for matching by skin rather than hostname.
   */
  matchClasses?: string[]
  /** CSS class names that indicate dark mode */
  darkClasses: string[]
  /** CSS class names that indicate "follow system preference" mode */
  systemClasses?: string[]
  /** Which element(s) to check. Default: 'both' */
  target?: 'body' | 'html' | 'both'
}

function matchHostname(hostname: string, pattern: string): boolean {
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(1) // '.fandom.com'
    return hostname.endsWith(suffix) || hostname === pattern.slice(2)
  }
  return hostname === pattern
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
      const { hostnamePatterns, matchClasses } = config
      const byHostname =
        hostnamePatterns && hostnamePatterns.length > 0
          ? hostnamePatterns.some((p) => matchHostname(location.hostname, p))
          : false
      const byClass =
        matchClasses && matchClasses.length > 0
          ? hasAnyClass(getTargetElements(target), matchClasses)
          : false
      return byHostname || byClass
    },

    getCurrentTheme(): ThemeMode {
      const elements = getTargetElements(target)
      if (hasAnyClass(elements, config.darkClasses)) return 'dark'
      // If a "follow system" class is present, delegate to prefers-color-scheme
      if (systemClasses.length > 0 && hasAnyClass(elements, systemClasses)) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      }
      return 'light'
    },

    startObserving(onChange: () => void): void {
      this.stopObserving()
      observer = new MutationObserver(onChange)
      for (const el of getTargetElements(target)) {
        observer.observe(el, { attributes: true, attributeFilter: ['class'] })
      }
      // Also listen to system preference changes for systemClasses support
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

/**
 * Built-in site theme adapters.
 * Ordered by specificity: site-specific adapters first, generic skin adapters last.
 */
export const BUILTIN_SITE_ADAPTERS: ClassBasedAdapterConfig[] = [
  // --- Site-specific adapters ---
  {
    name: 'Fandom',
    hostnamePatterns: ['*.fandom.com'],
    darkClasses: ['theme-fandomdesktop-dark', 'theme-fandommobile-dark'],
  },
  {
    name: 'MoeSkin',
    hostnamePatterns: ['*.moegirl.org.cn'],
    darkClasses: ['dark'],
    target: 'html',
  },
  // --- Generic MediaWiki skin adapters (match by class, any wiki) ---
  {
    name: 'Vector 2022',
    matchClasses: [
      'skin-theme-clientpref-day',
      'skin-theme-clientpref-night',
      'skin-theme-clientpref-os',
    ],
    darkClasses: ['skin-theme-clientpref-night'],
    systemClasses: ['skin-theme-clientpref-os'],
    target: 'html',
  },
]
