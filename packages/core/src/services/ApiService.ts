import { InPageEdit } from '@/InPageEdit'
import { FexiosConfigs } from 'wiki-saikou'
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
    if (location?.href && options?.baseURL?.toString()?.startsWith('/')) {
      options.baseURL = new URL(options.baseURL, location.origin)
    }
    const api = new MwApi({
      baseURL: options.baseURL!.toString(),
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
