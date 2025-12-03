import { InPageEdit } from '@/InPageEdit'
import { WikiFileRepo } from '@/types/WikiMetadata.js'
import { FexiosConfigs, WikiSaikouInitConfig } from 'wiki-saikou'
import { ForeignApi, MwApi } from 'wiki-saikou/browser'

export type * from 'wiki-saikou/browser'

declare module '@/InPageEdit' {
  interface InPageEdit {
    api: MwApi
    apiService: ApiService
  }
}

export interface ApiServiceOptions extends Partial<FexiosConfigs> {}

export class ApiService {
  api!: MwApi

  constructor(
    public ctx: InPageEdit,
    private options: Partial<ApiServiceOptions> = {}
  ) {
    if (location?.href && options?.baseURL?.toString()?.startsWith('/')) {
      options.baseURL = new URL(options.baseURL, location.origin)
    }
    const api = (this.api = new MwApi({
      baseURL: options.baseURL!.toString(),
      fexiosConfigs: {
        headers: {
          'x-api-user-agent': `InPageEdit-NEXT ${ctx.version}`,
          ...options.headers,
        },
        ...options,
      },
      throwOnApiError: true,
    }))
    ctx.set('api', api)
    ctx.set('apiService', this)
  }

  private _apiClients = new Map<string, MwApi>()
  getClientByFileRepo(repo: WikiFileRepo) {
    const endpointUrl = new URL(`${repo.scriptDirUrl}/api.php`, location.origin)
    const endpointHref = endpointUrl.toString()
    if (endpointHref === this.ctx.root.config.apiConfigs.baseURL?.toString()) {
      return this.ctx.api
    }
    if (!this._apiClients.has(endpointHref)) {
      const isSameOrigin = endpointUrl.origin === location.origin
      const initConfig: WikiSaikouInitConfig = {
        baseURL: endpointUrl.toString(),
        fexiosConfigs: {
          headers: {
            'x-api-user-agent': `InPageEdit-NEXT ${this.ctx.version} FileRepoClient`,
            ...this.options.headers,
          },
          ...this.options,
        },
        throwOnApiError: true,
      }
      const client = isSameOrigin ? new MwApi(initConfig) : new ForeignApi(initConfig)
      this._apiClients.set(endpointHref, client)
    }
    return this._apiClients.get(endpointHref)!
  }
}
