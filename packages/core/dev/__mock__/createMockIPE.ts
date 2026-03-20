import { MOCK_API_ENDPOINT_URL, mockFetch } from './mockMwApi.js'
import { useMockMwConfig } from './mockMwConfig.js'
import { MockMwHook } from './mockMwGlobal.js'

export { MOCK_API_ENDPOINT_URL } from './mockMwApi.js'
export { useMockMwConfig } from './mockMwConfig.js'
export { MockMwMap, MockMwHook } from './mockMwGlobal.js'

export interface CreateMockIPEOptions {
  /** Override InPageEdit config (merged with mock defaults) */
  config?: Record<string, any>
  /** If true, skip setting up window.mw globals */
  skipMwGlobals?: boolean
  /** If true, skip the default current-page/resolve-title hook */
  skipDefaultHooks?: boolean
}

/**
 * Create a mock InPageEdit instance for development and testing.
 * Uses dependency injection — pass in the InPageEdit constructor from your context.
 *
 * @param InPageEdit - The InPageEdit class (from local source or installed package)
 * @param options - Configuration options
 * @returns A configured InPageEdit instance
 *
 * @example
 * // In core dev (local source)
 * import { InPageEdit } from '../../src/InPageEdit.js'
 * const ipe = createMockIPE(InPageEdit)
 *
 * // In docs (installed package)
 * import { InPageEdit } from '@inpageedit/core'
 * const ipe = createMockIPE(InPageEdit)
 */
export function createMockIPE<T extends new (...args: any[]) => any>(
  InPageEdit: T,
  options: CreateMockIPEOptions = {}
): InstanceType<T> {
  const { config = {}, skipMwGlobals = false, skipDefaultHooks = false } = options

  if (!skipMwGlobals) {
    setupMwGlobals()
  }

  const ipe = new InPageEdit({
    autoloadStyles: false,
    apiConfigs: {
      baseURL: MOCK_API_ENDPOINT_URL.toString(),
      fetch: mockFetch,
    },
    ...config,
  })

  if (!skipMwGlobals) {
    // Wire up mw.hook('InPageEdit.ready') to replay on add
    // @ts-ignore fake hook add method
    window.mw.hook('InPageEdit.ready').add = (...handlers: any[]) => {
      handlers.forEach((fn: any) => fn(ipe))
    }
  }

  if (!skipDefaultHooks) {
    ipe.on('current-page/resolve-title', () => {
      return ipe.wikiTitle.newTitle('Example')
    })
  }

  return ipe
}

function setupMwGlobals() {
  window.mw = window.mw || ({} as any)
  ;(window.mw as any).config = useMockMwConfig()
  ;(window.mw as any).hook = (name: string) => {
    return new MockMwHook(name)
  }
}
