import { Inject, InPageEdit, Schema, Service } from '@/InPageEdit'
import { RegisterPreferences } from '@/decorators/Preferences'

type ThemePreference = 'light' | 'dark' | 'auto' | 'fandom'
type ThemeMode = 'light' | 'dark'

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
      Schema.const('fandom').description('Follow Fandom'),
    ])
      .default('auto')
      .description('Theme preference'),
  })
    .description('Theme settings')
    .extra('category', 'general')
)
export class ThemeService extends Service {
  private _mediaQueryList: MediaQueryList | null = null
  private _observer: MutationObserver | null = null

  private readonly _handleSystemThemeChange = this._onSystemThemeChange.bind(this)
  private readonly _handleBodyClassChange = this._onBodyClassChange.bind(this)

  constructor(public ctx: InPageEdit) {
    super(ctx, 'theme', false)
  }

  protected async start() {
    this._mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)')
    this._mediaQueryList.addEventListener('change', this._handleSystemThemeChange)
    this._observer = new MutationObserver(this._handleBodyClassChange)

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
    this._observer?.disconnect()
  }

  private async _onSystemThemeChange() {
    await this.applyTheme()
  }

  private async _onBodyClassChange() {
    await this.applyTheme()
  }

  async applyTheme() {
    const pref = (await this.ctx.preferences.get('theme')) || 'auto'

    this.updateFandomObserver(pref)

    const theme = this.getTheme(pref)
    this.applyThemeClass(theme)
    this.ctx.emit('theme/changed', { ctx: this.ctx, theme })
  }

  // don't run observer unless using fandom option
  private updateFandomObserver(pref: ThemePreference) {
    if (pref === 'fandom') {
      this._observer?.observe(document.body, {
        attributes: true,
        attributeFilter: ['class'],
      })
    } else {
      this._observer?.disconnect()
    }
  }

  private getTheme(pref: ThemePreference): ThemeMode {
    if (pref === 'auto') {
      return this._mediaQueryList?.matches ? 'dark' : 'light'
    }

    if (pref === 'fandom') {
      const body = document.body
      return body.classList.contains('theme-fandomdesktop-dark') ||
        body.classList.contains('theme-fandommobile-dark')
        ? 'dark'
        : 'light'
    }

    return pref
  }

  private applyThemeClass(theme: ThemeMode) {
    const root = document.body
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
