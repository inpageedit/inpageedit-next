import { Inject, InPageEdit, Schema, Service } from '@/InPageEdit'
import { RegisterPreferences } from '@/decorators/Preferences'

declare module '@/InPageEdit' {
  interface InPageEdit {
    theme: ThemeService
  }
  interface Events {
    'theme/changed'(payload: { ctx: InPageEdit; theme: 'light' | 'dark' }): void
  }
  interface PreferencesMap {
    theme: 'light' | 'dark' | 'auto' | 'fandom'
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

  constructor(public ctx: InPageEdit) {
    super(ctx, 'theme', false)
  }

  protected async start() {
    this._mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)')
    this._mediaQueryList.addEventListener('change', this._onSystemThemeChange.bind(this))
    this._observer = new MutationObserver(this._onBodyClassChange.bind(this))

    await this.applyTheme()

    this.ctx.on('preferences/changed', async ({ changes }) => {
      if ('theme' in changes) {
        await this.applyTheme()
      }
    })
  }

  protected stop() {
    if (this._mediaQueryList) {
      this._mediaQueryList.removeEventListener('change', this._onSystemThemeChange.bind(this))
    }
    this._observer?.disconnect()
  }

  private async _onSystemThemeChange() {
    const pref = await this.ctx.preferences.get('theme')
    if (pref === 'auto') {
      this.applyTheme()
    }
  }

  private async _onBodyClassChange() {
    const pref = await this.ctx.preferences.get('theme')
    if (pref === 'fandom') {
      this.applyTheme()
    }
  }

  async applyTheme() {
    const pref = (await this.ctx.preferences.get('theme')) || 'auto'

    // don't run observer unless using fandom option
    if (pref === 'fandom') {
      this._observer?.observe(document.body, {
        attributes: true,
        attributeFilter: ['class'],
      })
    } else {
      this._observer?.disconnect()
    }

    let theme: 'light' | 'dark' = 'light'

    if (pref === 'auto') {
      theme = this._mediaQueryList?.matches ? 'dark' : 'light'
    } else if (pref === 'fandom') {
      const body = document.body
      if (
        body.classList.contains('theme-fandomdesktop-dark') ||
        body.classList.contains('theme-fandommobile-dark')
      ) {
        theme = 'dark'
      } else {
        theme = 'light'
      }
    } else {
      theme = pref
    }

    const root = document.body
    if (theme === 'dark') {
      root.classList.add('ipe-theme-dark')
      root.setAttribute('data-ipe-theme', 'dark')
    } else {
      root.classList.remove('ipe-theme-dark')
      root.setAttribute('data-ipe-theme', 'light')
    }

    this.ctx.emit('theme/changed', { ctx: this.ctx, theme })
  }

  get currentTheme(): 'light' | 'dark' {
    return document.body.classList.contains('ipe-theme-dark') ? 'dark' : 'light'
  }
}
