export interface NpmPackage {
  _id?: string
  name: string
  description?: string
  homepage?: string
  license?: string
  keywords?: string[]
  readme?: string
  readmeFilename?: string
  author?: {
    name?: string
    email?: string
    url?: string
  }
  repository?: {
    type?: string
    url?: string
  }
  bugs?: {
    url?: string
    email?: string
  }
  maintainers?: { name?: string; email?: string }[]
  'dist-tags': Record<string, string>
  time: Record<string, string>
  versions?: Record<string, NpmPackageVersion>
  [key: string]: any
}

export interface NpmPackageVersion {
  name: string
  version: string
  description?: string
  license?: string
  keywords?: string[]
  author?: {
    name?: string
    email?: string
    url?: string
  }
  main?: string
  type?: string
  types?: string
  homepage?: string
  repository?: {
    type?: string
    url?: string
  }
  bugs?: {
    url?: string
  }
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  publishConfig?: Record<string, any>
  scripts?: Record<string, string>
  dist?: {
    integrity?: string
    shasum?: string
    tarball?: string
    fileCount?: number
    unpackedSize?: number
    signatures?: { sig?: string; keyid?: string }[]
  }
  exports?: Record<string, any>
  maintainers?: { name?: string; email?: string }[]
  _id?: string
  _npmVersion?: string
  _nodeVersion?: string
  _hasShrinkwrap?: boolean
  [key: string]: any
}

declare global {
  interface Window {
    [CACHE_KEY]?: Map<string, Promise<NpmPackage>>
  }
}

const CACHE_KEY = Symbol.for('NPM_REGISTRY_DATA')
const DEFAULT_NPM_REGISTRY = 'https://registry.npmjs.org/'
if (typeof document !== 'undefined' && !window[CACHE_KEY]) {
  window[CACHE_KEY] = new Map()
}

interface FetchNpmPackageOptions {
  noCache: boolean
  registry: string
}

export async function fetchNpmPackage(
  name: string,
  options?: Partial<FetchNpmPackageOptions>
): Promise<NpmPackage> {
  const { noCache = false, registry = DEFAULT_NPM_REGISTRY } = options || {}
  const cache = globalThis?.[CACHE_KEY] || new Map()
  if (cache.has(name) && !noCache) {
    return cache.get(name)!
  }
  const promise = fetch(new URL(`/${name}`, registry))
    .then((res) => {
      if (!res.ok) {
        throw new Error(`Failed to fetch package info: ${res.status} ${res.statusText}`)
      }
      return res.json() as Promise<NpmPackage>
    })
    .catch((err) => {
      cache.delete(name)
      throw err
    })
  cache.set(name, promise)
  return promise
}
