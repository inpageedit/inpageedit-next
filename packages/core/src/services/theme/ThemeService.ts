import { Inject, InPageEdit, Schema, Service } from '@/InPageEdit'
import { RegisterPreferences } from '@/decorators/Preferences'
import {
  BUILTIN_SITE_ADAPTERS,
  createClassBasedAdapter,
  type SiteThemeAdapter,
  type ThemeMode,
} from './SiteThemeAdapter'

type ThemePreference = 'light' | 'dark' | 'auto' | 'site'

declare module '@/InPageEdit' {
  interface InPageEdit {
    theme: ThemeService
  }
  interface Events {
    'theme/changed'(payload: { ctx: InPageEdit; theme: ThemeMode }): void
  }
  interface PreferencesMap {
    theme: ThemePreference
  }
}

@Inject(['preferences'])
@RegisterPreferences(
  Schema.object({
    theme: Schema.union([
      Schema.const('auto').description('Follow system'),
      Schema.const('light').description('Light mode'),
      Schema.const('dark').description('Dark mode'),
      Schema.const('site').description('Follow site theme'),
    ])
      .default('auto')
      .description('Theme preference'),
  })
    .description('Theme settings')
    .extra('category', 'general')
)
export class ThemeService extends Service {
  private _mediaQueryList: MediaQueryList | null = null
  private adapters: SiteThemeAdapter[] = []
  private activeAdapter: SiteThemeAdapter | null = null
  private _applyingTheme = false

  private readonly _handleSystemThemeChange = this._onSystemThemeChange.bind(this)

  constructor(public ctx: InPageEdit) {
    super(ctx, 'theme', false)
  }

  protected async start() {
    this._mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)')
    this._mediaQueryList.addEventListener('change', this._handleSystemThemeChange)

    // Register built-in site theme adapters
    for (const config of BUILTIN_SITE_ADAPTERS) {
      this.registerSiteThemeAdapter(createClassBasedAdapter(config))
    }

    await this.applyTheme()

    this.ctx.on('preferences/changed', async ({ changes }) => {
      if ('theme' in changes) {
        await this.applyTheme()
      }
    })
  }

  protected stop() {
    if (this._mediaQueryList) {
      this._mediaQueryList.removeEventListener('change', this._handleSystemThemeChange)
    }
    this.activeAdapter?.stopObserving()
  }

  /**
   * Register a site theme adapter. Returns a dispose function to unregister it.
   * Custom adapters take priority over previously registered (built-in) ones.
   */
  registerSiteThemeAdapter(adapter: SiteThemeAdapter): () => void {
    this.adapters.unshift(adapter)
    this.resolveActiveAdapter()
    this.applyTheme()
    return () => {
      this.adapters = this.adapters.filter((a) => a !== adapter)
      if (this.activeAdapter === adapter) {
        adapter.stopObserving()
        this.activeAdapter = null
        this.resolveActiveAdapter()
      }
      this.applyTheme()
    }
  }

  private resolveActiveAdapter() {
    this.activeAdapter = this.adapters.find((a) => a.match()) ?? null
  }

  private async _onSystemThemeChange() {
    await this.applyTheme()
  }

  async applyTheme() {
    // Reentrancy guard: on sites like Fandom, modifying body classList can trigger
    // third-party MutationObservers (e.g. ext.fandom.Thumbnails.js) which may mutate
    // body class again, re-triggering our own site-theme observer. Combined with the
    // async yield at `await preferences.get()`, this creates a cascading feedback loop
    // that spawns thousands of concurrent applyTheme calls and listener registrations.
    if (this._applyingTheme) return
    this._applyingTheme = true
    try {
      const pref = (await this.ctx.preferences.get('theme')) || 'auto'

      this.updateSiteObserver(pref)

      const theme = this.getTheme(pref)
      this.applyThemeClass(theme)
      this.ctx.emit('theme/changed', { ctx: this.ctx, theme })
    } finally {
      this._applyingTheme = false
    }
  }

  private updateSiteObserver(pref: ThemePreference) {
    if (pref === 'site' && this.activeAdapter) {
      this.activeAdapter.startObserving(() => this.applyTheme())
    } else {
      this.activeAdapter?.stopObserving()
    }
  }

  private getTheme(pref: ThemePreference): ThemeMode {
    if (pref === 'auto') {
      return this._mediaQueryList?.matches ? 'dark' : 'light'
    }

    if (pref === 'site') {
      if (this.activeAdapter) {
        return this.activeAdapter.getCurrentTheme()
      }
      // Fallback to auto when no adapter matches
      return this._mediaQueryList?.matches ? 'dark' : 'light'
    }

    return pref
  }

  private applyThemeClass(theme: ThemeMode) {
    const root = document.body
    // Skip redundant DOM writes to avoid triggering MutationObservers unnecessarily
    const current = root.getAttribute('data-ipe-theme')
    if (current === theme) return

    if (theme === 'dark') {
      root.classList.add('ipe-theme-dark')
      root.setAttribute('data-ipe-theme', 'dark')
    } else {
      root.classList.remove('ipe-theme-dark')
      root.setAttribute('data-ipe-theme', 'light')
    }
  }

  get currentTheme(): ThemeMode {
    return document.body.classList.contains('ipe-theme-dark') ? 'dark' : 'light'
  }
}
