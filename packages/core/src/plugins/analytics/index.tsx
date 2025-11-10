import { Endpoints } from '@/constants/endpoints.js'
import { Inject, InPageEdit, Schema } from '@/InPageEdit'

declare module '@/InPageEdit' {
  interface InPageEdit {
    analytics: PluginAnalytics
  }
}

export interface IPEBeaconPayload {
  siteApi: string
  siteName?: string
  userId: number
  userName: string
  version?: string
  usages: IPEBeaconUsage[]
}

export interface IPEBeaconUsage {
  ts: number
  feature: string
  subtype?: string
  page?: string
}

@Inject(['wiki', 'preferences'])
export class PluginAnalytics extends BasePlugin {
  private _usages: IPEBeaconUsage[] = []
  private _timer: ReturnType<typeof setInterval> | null = null
  private readonly MAX_QUEUE_SIZE = 50
  private readonly INTERVAL_MS = 60 * 1000 // 1分钟

  constructor(public ctx: InPageEdit) {
    super(ctx, {}, 'analytics')
    this._setupTimer()
    this._registerUnloadHandler()
    this._showConfirmNotify()
    this._initPluginListeners()
    ctx.set('analytics', this)
  }

  protected start(): Promise<void> | void {
    const ctx = this.ctx
    ctx.preferences.registerCustomConfig(
      'analytics',
      Schema.object({
        'analytics._intro': Schema.const(
          <section>
            <h3>InPageEdit Analytics</h3>
            <p>
              InPageEdit Analytics is the companion analytics platform for the InPageEdit NEXT
              project. By collecting and displaying usage data from around the world, it helps
              developers and the community better understand how the tool is used, optimize feature
              design, and enhance user experience.
            </p>
            <h4>What data will be collected?</h4>
            <ol style={{ listStyle: 'number', paddingLeft: '1em' }}>
              <li>
                <strong>Usage data</strong>: When and which features you use, what pages you edit,
                etc.
              </li>
              <li>
                <strong>User information</strong>: Your user name and user ID.
              </li>
              <li>
                <strong>Site information</strong>: This wiki's url and site name.
              </li>
            </ol>
            <p>
              <strong>NO sensitive data will be collected.</strong>
            </p>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <a href={this.analyticsDashUrl} target="_blank" rel="noopener noreferrer">
                <button className="btn" style={{ width: '100%' }}>
                  Analytics Platform
                </button>
              </a>
              <a
                href={`${this.analyticsDashUrl}/_redirect/user?${new URLSearchParams({
                  siteApi: this.ctx.wiki.getSciprtUrl('api'),
                  mwUserId: this.ctx.wiki.userInfo.id.toString(),
                }).toString()}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <button className="btn" style={{ width: '100%' }}>
                  View My Data
                </button>
              </a>
            </div>
          </section>
        ).role('raw-html'),
        'analytics.enabled': Schema.boolean()
          .description('Share my usage data with the community.')
          .default(false),
      }).description('Analytics settings'),
      'general'
    )
  }

  private get analyticsDashUrl() {
    return import.meta.env.PROD ? Endpoints.ANALYTICS_DASH_URL : 'http://localhost:20105'
  }
  private get analyticsApiBase() {
    return import.meta.env.PROD ? Endpoints.ANALYTICS_API_BASE : 'http://localhost:20105/api/v6'
  }

  private _setupTimer() {
    this._timer = setInterval(() => {
      if (this._usages.length > 0) {
        this.sendBeacon()
      }
    }, this.INTERVAL_MS)
  }

  private _registerUnloadHandler() {
    const handleUnload = () => {
      if (this._usages.length > 0) {
        this.sendBeacon()
      }
    }

    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        handleUnload()
      }
    })

    window.addEventListener('pagehide', handleUnload)
    window.addEventListener('beforeunload', handleUnload)
  }

  private async _showConfirmNotify() {
    this.ctx.inject(['modal', 'storage'], async (ctx) => {
      const key = 'analytics/confirm-shown'
      const shown = await ctx.storage.simpleKV.get(key)
      const enabled = await ctx.preferences.get('analytics.enabled')
      if (shown || enabled) {
        return
      }
      ctx.modal.notify(
        'confirm',
        {
          title: 'Enable Analytics',
          content: (
            <div>
              <p>Help us improve InPageEdit by sharing your usage data with us.</p>
              <p>What data will be collected?</p>
              <ul style={{ listStyle: 'auto', paddingLeft: '1.5em' }}>
                <li>Usage data: What features you use, what pages you edit, etc.</li>
                <li>User information: Your username, user ID.</li>
                <li>Site information: The wiki you are editing.</li>
              </ul>
              <p>
                <strong>NO sensitive data will be collected.</strong>
              </p>
            </div>
          ),
          okBtn: {
            label: 'Enable',
          },
          cancelBtn: {
            label: 'Disable',
          },
          closeAfter: 0,
          onClose: () => {
            this.ctx.storage.simpleKV.set(key, 1)
          },
        },
        (result) => {
          ctx.preferences.set('analytics.enabled', result)
          if (result) {
            this.addEvent('analytics', 'enabled')
          }
        }
      )
    })
  }

  private _initPluginListeners() {
    const ctx = this.ctx
    ctx.on('in-article-links/anchor-clicked', (payload) => {
      this.addEvent('in-article-links', paramCase(payload.action))
    })
    ctx.on('quick-diff/loaded', (payload) => {
      this.addEvent('quick-diff', 'loaded', payload.compare.fromtitle)
    })
    ctx.on('quick-redirect/submit', (payload) => {
      this.addEvent('quick-redirect', 'submit', payload.payload.to || undefined)
    })
    ctx.on('quick-preview/loaded', (payload) => {
      this.addEvent('quick-preview', 'loaded', payload.wikiPage.title)
    })
    ctx.on('quick-edit/wiki-page', (payload) => {
      this.addEvent('quick-edit', undefined, payload.wikiPage.title)
    })
    ctx.on('quick-edit/submit', (payload) => {
      this.addEvent('quick-edit', 'submit', payload.wikiPage.title)
    })
    ctx.on('quick-move/submit', (payload) => {
      this.addEvent('quick-move', 'submit')
    })
    ctx.on('toolbox/button-clicked', (payload) => {
      this.addEvent('toolbox', `button-clicked#${payload.id || 'unknown'}`)
    })
  }

  public addEvent(feature: string, subtype?: string, page?: string) {
    const usage: IPEBeaconUsage = {
      ts: Date.now(),
      feature,
      subtype,
      page,
    }
    this._usages.push(usage)

    // 如果usages数组超过50个，立即发送
    if (this._usages.length >= this.MAX_QUEUE_SIZE) {
      this.sendBeacon()
    }

    return this
  }

  private async sendBeacon() {
    if (this._usages.length === 0) {
      return true
    }

    const enabled = await this.ctx.preferences.get<boolean>('analytics.enabled', false)
    if (!enabled) {
      this.logger.debug('Analytics disabled, skipping')
      return true
    }

    const usages = this._usages.splice(0, this._usages.length)
    const payload: IPEBeaconPayload = {
      siteApi: this.ctx.wiki.getSciprtUrl('api'),
      siteName: this.ctx.wiki.siteInfo.general.sitename,
      userId: this.ctx.wiki.userInfo.id,
      userName: this.ctx.wiki.userInfo.name,
      version: this.ctx.version.split('-')[0],
      usages,
    }
    const body = JSON.stringify(payload)

    const endpoint = `${this.analyticsApiBase}/submit`

    const beaconOK = navigator?.sendBeacon?.(endpoint, body)
    if (beaconOK) {
      this.logger.debug('Beacon sent successfully', payload)
      return true
    } else {
      this.logger.debug('Beacon failed, sending via XMLHttpRequest')
      const { promise, resolve, reject } = promiseWithResolvers<boolean>()
      try {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', endpoint, true)
        xhr.setRequestHeader('Content-Type', 'application/json')
        xhr.send(body)
        xhr.onload = () => {
          this.logger.debug('Beacon sent successfully via XMLHttpRequest', payload)
          resolve(xhr.status >= 200 && xhr.status < 300)
        }
        xhr.onerror = () => {
          reject(new Error('Failed to send beacon'))
        }
      } catch (error) {
        reject(error)
      }
      return promise
    }
  }

  /**
   * 清理资源
   */
  protected stop() {
    if (this._timer !== null) {
      clearInterval(this._timer)
      this._timer = null
    }
    // 在销毁前发送剩余的数据
    if (this._usages.length > 0) {
      this.sendBeacon()
    }
  }
}
