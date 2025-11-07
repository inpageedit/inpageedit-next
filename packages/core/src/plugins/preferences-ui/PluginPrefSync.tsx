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
      'pref-sync-user-page',
      Schema.object({
        'pref-sync-user-page': Schema.const(
          <section>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <button
                className="btn primary"
                onClick={(e) => {
                  e.preventDefault()
                  const modal = ctx.preferencesUI.getExistingModal()
                  const btn = e.target as HTMLButtonElement
                  btn.disabled = true
                  modal?.setLoadingState(true)
                  this.importFromUserPage()
                    .then((record) => {
                      this.notifyImportSuccess(record)
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
                className="btn primary"
                onClick={(e) => {
                  e.preventDefault()
                  const btn = e.target as HTMLButtonElement
                  btn.disabled = true
                  const modal = ctx.preferencesUI.getExistingModal()
                  modal?.setLoadingState(true)
                  this.exportToUserPage()
                    .then((title) => {
                      ctx.modal.notify('success', {
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
        ).role('raw-html'),
      }).description('Backup your preferences via user page'),
      'pref-sync'
    )
    ctx.preferences.registerCustomConfig(
      'pref-sync-manual',
      Schema.object({
        'pref-sync-manual': Schema.const(
          <section>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <button
                className="btn"
                onClick={(e) => {
                  e.preventDefault()
                  const modal = ctx.preferencesUI.getExistingModal()
                  modal?.setLoadingState(true)
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = 'application/json'
                  input.addEventListener('change', async (e) => {
                    try {
                      const file = (e.target as HTMLInputElement).files?.[0]
                      if (!file) {
                        return
                      }
                      const record = await this.importFromFile(file)
                      this.notifyImportSuccess(record)
                      modal?.close?.()
                    } catch (e) {
                      ctx.modal.notify('error', {
                        title: 'Import failed',
                        content: e instanceof Error ? e.message : String(e),
                      })
                    } finally {
                      modal?.setLoadingState(false)
                    }
                  })
                  input.addEventListener('cancel', () => {
                    modal?.setLoadingState(false)
                  })
                  input.click()
                }}
              >
                Import from file
              </button>
              <button
                className="btn"
                onClick={async (e) => {
                  e.preventDefault()
                  const data = await ctx.preferences.getExportableRecord()
                  const json = JSON.stringify(data, null, 2)
                  ctx.modal.dialog(
                    {
                      title: 'Save to file',
                      content: (
                        <div>
                          <label htmlFor="data">Your InPageEdit preferences:</label>
                          <textarea
                            name="data"
                            id="data"
                            rows={10}
                            value={json}
                            readOnly
                            style={{ width: '100%' }}
                          ></textarea>
                        </div>
                      ),
                      buttons: [
                        {
                          label: 'Copy',
                          method: () => {
                            navigator.clipboard.writeText(json)
                            ctx.modal.notify('success', {
                              content: 'Copied to clipboard',
                            })
                          },
                        },
                        {
                          label: 'Download',
                          method: () => {
                            const a = document.createElement('a')
                            a.href = `data:text/json;charset=utf-8,${encodeURIComponent(json)}`
                            a.download = `ipe-prefs-${new Date().toISOString()}.json`
                            a.click()
                          },
                        },
                      ],
                    },
                    () => {}
                  )
                }}
              >
                Save to file
              </button>
            </div>
          </section>
        ).role('raw-html'),
      }).description('Backup your preferences to file'),
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

      const blob = await response.blob()
      const changed = await this.importFromFile(blob)
      this.logger.info('Loaded preferences from user page:', title)
      return changed
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

    const json = await ctx.preferences.getExportableRecord()
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

  async importFromFile(input: Blob): Promise<Record<string, unknown>> {
    const text = await input.text()
    const data = JSON.parse(text)
    const changed = await this.ctx.preferences.setMany(data)
    return changed
  }

  private notifyImportSuccess(configs?: Record<string, unknown>) {
    const keys = Object.keys(configs ?? {})
    const count = keys.length
    return this.ctx.modal.notify('success', {
      title: 'Preferences Imported',
      content: (
        <section>
          <p>
            Successfully imported {count || ''} {count !== 1 ? 'settings' : 'setting'}:
          </p>
          <ol style={{ listStyle: 'auto', paddingLeft: '1em' }}>
            {keys.map((key) => (
              <li key={key}>{key}</li>
            ))}
          </ol>
        </section>
      ),
    })
  }
}
