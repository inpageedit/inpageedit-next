import { InPageEdit } from '@/InPageEdit'
import { FexiosConfigs } from 'fexios'
import { MwApi } from 'wiki-saikou/browser'

declare module '@/InPageEdit' {
  interface InPageEdit {
    api: MwApi
  }
}

export interface ApiServiceOptions extends Partial<FexiosConfigs> {}

export class ApiService {
  constructor(
    public ctx: InPageEdit,
    options: Partial<ApiServiceOptions> = {}
  ) {
    if (options?.baseURL?.startsWith('/')) {
      options.baseURL = new URL(options.baseURL, location.origin).href
    }
    const api = new MwApi({
      baseURL: options.baseURL!,
      fexiosConfigs: {
        headers: {
          'x-api-user-agent': `InPageEdit-NEXT ${ctx.version}`,
          ...options.headers,
        },
        ...options,
      },
      throwOnApiError: true,
    })
    ctx.set('api', api)
  }
}
