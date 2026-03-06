export type ThemeMode = 'light' | 'dark'

export interface SiteThemeAdapter {
  /** Display name, e.g. "Fandom", "Moegirl" */
  name: string
  /** Whether this adapter handles the given hostname */
  match(hostname: string): boolean
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
  patterns: string[]
  /** CSS class names that indicate dark mode */
  darkClasses: string[]
  /** Which element(s) to check for dark classes. Default: 'both' */
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

function hasDarkClass(elements: Element[], darkClasses: string[]): boolean {
  return elements.some((el) => darkClasses.some((cls) => el.classList.contains(cls)))
}

export function createClassBasedAdapter(config: ClassBasedAdapterConfig): SiteThemeAdapter {
  const target = config.target ?? 'both'
  let observer: MutationObserver | null = null

  return {
    name: config.name,

    match(hostname: string): boolean {
      return config.patterns.some((p) => matchHostname(hostname, p))
    },

    getCurrentTheme(): ThemeMode {
      return hasDarkClass(getTargetElements(target), config.darkClasses) ? 'dark' : 'light'
    },

    startObserving(onChange: () => void): void {
      this.stopObserving()
      observer = new MutationObserver(onChange)
      for (const el of getTargetElements(target)) {
        observer.observe(el, { attributes: true, attributeFilter: ['class'] })
      }
    },

    stopObserving(): void {
      observer?.disconnect()
      observer = null
    },
  }
}

export const BUILTIN_SITE_ADAPTERS: ClassBasedAdapterConfig[] = [
  {
    name: 'Fandom',
    patterns: ['*.fandom.com'],
    darkClasses: ['theme-fandomdesktop-dark', 'theme-fandommobile-dark'],
  },
  {
    name: 'Moegirl',
    patterns: ['*.moegirl.org.cn'],
    darkClasses: ['skin-citizen-dark'],
  },
]
