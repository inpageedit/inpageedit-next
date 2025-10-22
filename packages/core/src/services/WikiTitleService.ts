import { Inject, InPageEdit, Service } from '@/InPageEdit'
import { createWikiTitleModel, WikiTitleConstructor } from '@/models/WikiTitle/index.js'

declare module '@/InPageEdit' {
  interface InPageEdit {
    wikiTitle: WikiTitleService
  }
}

export class WikiTitleService extends Service {
  static readonly inject = ['sitemeta'] as const

  readonly WikiTitle: WikiTitleConstructor
  constructor(public ctx: InPageEdit) {
    super(ctx, 'wikiTitle', true)
    this.WikiTitle = createWikiTitleModel(this.ctx.sitemeta._raw)
  }

  create(title: string, namespace?: number) {
    return new this.WikiTitle(title, namespace)
  }
}
