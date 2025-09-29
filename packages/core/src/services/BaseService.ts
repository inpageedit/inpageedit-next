import { InPageEdit } from '@/InPageEdit'
import { Service } from '@cordisjs/core'

export class BaseService<Config = any> extends Service<Config, InPageEdit> {
  get logger() {
    return this.ctx.logger
  }
  get schema() {
    return this.ctx.schema
  }
}
