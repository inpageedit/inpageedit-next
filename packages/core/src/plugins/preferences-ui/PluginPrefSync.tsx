import { Inject, InPageEdit, Schema } from '@/InPageEdit.js'
import { WatchlistAction } from '@/models/WikiPage/types/WatchlistAction.js'
import { IWikiTitle } from '@/models/WikiTitle/index.js'

declare module '@/InPageEdit' {
  export interface InPageEdit {
    prefSync: PluginPrefSync
  }
}

@Inject(['preferences', 'wikiPage', 'wikiTitle', 'modal', 'preferencesUI'])
export class PluginPrefSync extends BasePlugin {
  constructor(public ctx: InPageEdit) {
    super(ctx, {}, 'pref-sync')
    ctx.set('prefSync', this)
  }

  protected start(): Promise<void> | void {
    const ctx = this.ctx
    ctx.preferences.defineCategory({
      name: 'pref-sync',
      label: 'Sync',
      description: 'Import and export preferences',
      index: 98,
    })
    ctx.preferences.registerCustomConfig(
      'pref-sync',
      Schema.object({
        'preferences-ui-pref-sync': Schema.const(
          <section>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={(e) => {
                  e.preventDefault()
                  const modal = ctx.preferencesUI.getExistingModal()
                  const btn = e.target as HTMLButtonElement
                  btn.disabled = true
                  modal?.setLoadingState(true)
                  this.importFromUserPage()
                    .then((record) => {
                      const count = Object.keys(record ?? {}).length
                      this.ctx.modal.notify('success', {
                        title: 'Preferences Imported',
                        content: (
                          <div>
                            <div>
                              Successfully imported {count} {count > 1 ? 'settings' : 'setting'}:
                            </div>
                            <ol style={{ listStyle: 'auto', paddingLeft: '1em' }}>
                              {Object.entries(record ?? {}).map(([key, value]) => (
                                <li key={key}>
                                  {key}: {value?.toString()}
                                </li>
                              ))}
                            </ol>
                          </div>
                        ),
                      })
                      modal?.close?.()
                    })
                    .finally(() => {
                      btn.disabled = false
                      modal?.setLoadingState(false)
                    })
                }}
              >
                Import
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault()
                  const btn = e.target as HTMLButtonElement
                  btn.disabled = true
                  const modal = ctx.preferencesUI.getExistingModal()
                  modal?.setLoadingState(true)
                  this.exportToUserPage()
                    .then((title) => {
                      this.ctx.modal.notify('success', {
                        title: 'Preferences Exported',
                        content: (
                          <p>
                            Your preferences have been exported to{' '}
                            <a href={title.getURL().toString()} target="_blank">
                              {title.getPrefixedText()}
                            </a>
                            .
                          </p>
                        ),
                      })
                      modal?.close?.()
                    })
                    .finally(() => {
                      btn.disabled = false
                      modal?.setLoadingState(false)
                    })
                }}
              >
                Export
              </button>
            </div>
          </section>
        )
          .description('Backup your preferences to user page')
          .role('raw-html'),
      }).description('Backup your preferences to user page'),
      'pref-sync'
    )
  }

  protected stop(): Promise<void> | void {}

  /**
   * 获取用户页配置文件的标题
   */
  private getUserPrefsPageTitle(): IWikiTitle | null {
    try {
      const userName = this.ctx.wiki?.userInfo?.name
      if (!userName) {
        return null
      }
      // 使用 User: 命名空间
      return this.ctx.wikiTitle.newTitle(`User:${userName}/ipe-prefs.json`, 2)
    } catch {
      return null
    }
  }

  /**
   * 从用户页加载配置
   */
  async importFromUserPage(): Promise<Record<string, unknown>> {
    const ctx = this.ctx
    const title = this.getUserPrefsPageTitle()
    if (!title) {
      this.logger.debug('Cannot get user page title, skipping load')
      return {}
    }

    try {
      // 使用 raw action 获取 JSON 内容
      const rawUrl = title.getURL({ action: 'raw', ctype: 'application/json' })

      let response: Response
      try {
        response = await fetch(rawUrl.toString())
        if (!response.ok) {
          if (response.status === 404) {
            this.logger.debug('User preferences page does not exist')
            return {}
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
      } catch (error) {
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
          this.logger.debug('User preferences page does not exist or network error')
          return {}
        }
        throw error
      }

      // 解析 JSON 内容
      let preferences: Record<string, any>
      try {
        preferences = await response.json()
      } catch (error) {
        this.logger.warn('Failed to parse user preferences JSON:', error)
        return {}
      }

      for (const [key, value] of Object.entries(preferences)) {
        await ctx.preferences.set(key, value)
      }

      this.logger.info('Loaded preferences from user page:', title)
      return preferences
    } catch (error) {
      this.logger.error('Failed to load preferences from user page:', error)
      return {}
    }
  }

  /**
   * 导出配置到用户页
   */
  async exportToUserPage(): Promise<IWikiTitle> {
    const ctx = this.ctx
    const title = this.getUserPrefsPageTitle()
    if (!title) {
      throw new Error('Cannot get user page title')
    }

    const json = await ctx.preferences.getExportable()
    const text = JSON.stringify(json, null, 2)

    try {
      const page = this.ctx.wikiPage.newBlankPage({
        title: title.toString(),
        ns: 2, // User namespace
      })
      await page.edit({
        text,
        summary: 'Update InPageEdit preferences',
        watchlist: WatchlistAction.nochange,
      })

      this.logger.info('Exported preferences to user page:', title)
      return title
    } catch (error) {
      this.logger.error('Failed to export preferences to user page:', error)
      throw error
    }
  }
}
