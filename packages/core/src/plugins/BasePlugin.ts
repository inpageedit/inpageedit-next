import { Inject, InPageEdit, Schema } from '@/InPageEdit'
import { snakeCase } from '@/utils/string'

interface DisposeHandler {
  (ctx: InPageEdit): Promise<void> | void
}

export default class BasePlugin<ConfigType extends unknown = any> {
  #name!: string
  public config: ConfigType
  private disposeHandlers: DisposeHandler[] = []
  /** 依赖注入 */
  static inject?: Inject = []
  /** 可重用？ */
  static reusable = false
  /** 插件的偏好设置模式 */
  static PreferencesSchema?: Schema
  /** 插件的偏好设置默认值 */
  static PreferencesDefaults?: Record<string, any>

  constructor(
    public ctx: InPageEdit,
    config: ConfigType = undefined as unknown as ConfigType,
    name?: string
  ) {
    this.name = name || this.constructor.name
    this.config = config || ({} as ConfigType)
    const { promise, resolve, reject } = Promise.withResolvers<void>()
    queueMicrotask(() => {
      try {
        const ret = this.start()
        if (ret && typeof (ret as Promise<unknown>).then === 'function') {
          ;(ret as Promise<unknown>)
            .then(() => resolve())
            .catch((err) => {
              this.logger.error('Plugin start failed', err)
              reject(err)
            })
        } else {
          resolve()
        }
      } catch (err) {
        this.logger.error('Plugin start threw synchronously', err)
        reject(err)
      }

      promise.then(() => {
        this.logger.info('Plugin started')
      })
      promise.catch((e) => {
        this.logger.error('Plugin start failed', e)
        this.ctx.scope.dispose()
      })
    })
    this.ctx.once('dispose', () => {
      this.disposeHandlers.forEach((fn) => fn(this.ctx))
      this.stop()
      this.logger.info('Plugin disposed')
    })
  }

  protected start(): Promise<void> | void {}
  protected stop(): Promise<void> | void {}
  protected addDisposeHandler(fn: DisposeHandler) {
    this.disposeHandlers.push(fn)
  }
  protected removeDisposeHandler(fn: DisposeHandler) {
    this.disposeHandlers = this.disposeHandlers.filter((f) => f !== fn)
  }

  set name(name: string) {
    this.#name = snakeCase(name).toUpperCase()
  }
  get name() {
    return this.#name
  }

  get logger() {
    return this.ctx.logger(this.name)
  }
}
