import { InPageEdit } from '@/InPageEdit'
import { MwApi } from 'wiki-saikou'

declare module '@/InPageEdit' {
  interface InPageEdit {
    api: MwApi
  }
}

export interface ApiServiceOptions {
  baseURL: string | URL
}

export class ApiService {
  constructor(
    public ctx: InPageEdit,
    options?: Partial<ApiServiceOptions>
  ) {
    let baseURL =
      typeof options?.baseURL === 'string' ? options.baseURL : options?.baseURL?.toString()
    if (baseURL?.startsWith('/')) {
      baseURL = new URL(baseURL, location.origin).href
    }
    const api = new MwApi(baseURL, {
      headers: {
        'x-api-user-agent': `InPageEdit-NEXT ${ctx.version}`,
      },
    })
    ctx.set('api', api)
  }
}
