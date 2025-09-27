import { InPageEdit } from '@/InPageEdit'

export const defineAsyncPlugin = (factory: () => Promise<any>) => {
  return async (ctx: InPageEdit, configs?: any) => {
    const plugin = await factory()
    ctx.plugin(plugin, configs)
  }
}
