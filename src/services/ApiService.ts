import { InPageEdit } from '@/InPageEdit'
import { MwApi } from 'wiki-saikou'

declare module '@/InPageEdit' {
  interface InPageEdit {
    api: MwApi
  }
}

export class ApiService {
  constructor(public ctx: InPageEdit) {
    const api = new MwApi(undefined, {
      headers: {
        'x-api-user-agent': `@inpageedit/core ${version}`,
      },
    })
    ctx.set('api', api)
  }
}
