import { Inject, InPageEdit } from '@/InPageEdit'

declare module '@/InPageEdit' {
  export interface InPageEdit {
    preferences: PluginPreferences
  }
}

@Inject(['sitemeta'])
export class PluginPreferences extends BasePlugin {
  constructor(public ctx: InPageEdit) {
    super(ctx, {}, 'preferences')
    ctx.set('preferences', this)
  }
}
