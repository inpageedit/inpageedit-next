import Schema from 'schemastery'

export const PLUGIN_STORE_REGISTRY_MANIFEST_VERSION = 1

export interface PluginStoreRegistry {
  manifest_version: number
  name: string
  base_url: string
  homepage?: string
  maintainers?: PluginStoreRegistryMaintainer[]
  repository?: PluginStoreRegistryRepository
  packages: PluginStorePackage[]
}

export interface PluginStoreRegistryMaintainer {
  name: string
  email?: string
}

export interface PluginStoreRegistryRepository {
  type: string
  url: string
}

export interface PluginStorePackage {
  id: string
  name: string
  version: string
  description?: string
  author?: string
  license?: string
  loader: PluginStorePackageLoader
}

export interface PluginStorePackageLoader {
  kind: 'autoload' | 'module' | 'umd' | 'styles'
  entry?: string
  styles?: string[]
  main_export?: string
}

export namespace PluginStoreSchemas {
  export const PackageLoader = new Schema<PluginStorePackageLoader>(
    Schema.object({
      kind: Schema.union(['autoload', 'module', 'umd', 'styles']).required().default('autoload'),
      entry: Schema.string(),
      styles: Schema.array(Schema.string()),
      main_export: Schema.string(),
    })
  )

  export const Package = new Schema<PluginStorePackage>(
    Schema.object({
      id: Schema.string().required(),
      name: Schema.string().required(),
      version: Schema.string().required(),
      description: Schema.string(),
      author: Schema.string(),
      license: Schema.string(),
      loader: PackageLoader.required(),
    })
  )

  export const RegistryMaintainer = new Schema<PluginStoreRegistryMaintainer>(
    Schema.object({
      name: Schema.string().required(),
      email: Schema.string(),
    })
  )

  export const RegistryRepository = new Schema<PluginStoreRegistryRepository>(
    Schema.object({
      type: Schema.string().required(),
      url: Schema.string().required(),
    })
  )

  export const Registry = new Schema<PluginStoreRegistry>(
    Schema.object({
      manifest_version: Schema.number().min(PLUGIN_STORE_REGISTRY_MANIFEST_VERSION).required(),
      name: Schema.string().required(),
      base_url: Schema.string().required(),
      homepage: Schema.string(),
      maintainers: Schema.array(RegistryMaintainer),
      repository: RegistryRepository,
      packages: Schema.array(Package).required(),
    })
  )
}
