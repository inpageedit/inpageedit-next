import { InPageEdit, Logger } from '@/InPageEdit'
import { snakeCase } from '@/utils/string'

interface DisposeHandler {
  (ctx: InPageEdit): Promise<void> | void
}

export default class BasePlugin<T extends unknown = any> {
  #name!: string
  public config: T
  private disposeHandlers: DisposeHandler[] = []

  constructor(
    public ctx: InPageEdit,
    config: T = undefined as unknown as T,
    name?: string
  ) {
    this.name = name || this.constructor.name
    this.config = config || ({} as T)
    this.start()
    this.ctx.once('dispose', () => {
      this.disposeHandlers.forEach((fn) => fn(this.ctx))
      this.stop()
    })
    this.logger.debug('Plugin initialized')
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

  get logger(): Logger {
    return this.ctx.logger(this.name)
  }
}
