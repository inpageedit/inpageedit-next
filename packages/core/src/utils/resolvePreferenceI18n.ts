import type Schema from 'schemastery'

type MessageLookup = (key: string) => string | undefined

/**
 * Walk a Schemastery schema tree and resolve `meta.description` values
 * from i18n using convention-based key mapping.
 *
 * Convention:
 * - Group/section title:    `prefs.{prefix}.$title`      e.g. `prefs.quickEdit.$title`
 * - Field (leaf, no children): `prefs.{key}`              e.g. `prefs.quickEdit.editMinor`
 * - Field (has children):   `prefs.{key}.$label`          e.g. `prefs.quickEdit.editFont.$label`
 * - Union/const option:     `prefs.{parentKey}.{value}`   e.g. `prefs.quickEdit.editFont.monospace`
 *
 * Legacy fallbacks (remove after i18n repo migration):
 * - `prefs.{prefix}.$` → `$title`
 * - `prefs.{key}.description` / `prefs.{key}.$` → `$label`
 *
 * Falls back to original `meta.description` if no i18n key is found.
 */
export function resolvePreferenceI18n(
  schema: Schema,
  lookup: MessageLookup,
  parentKey?: string
): Schema {
  if (!schema || !schema.type) return schema

  switch (schema.type) {
    case 'intersect':
      return cloneWithList(schema, (list) =>
        list.map((s) => resolvePreferenceI18n(s, lookup, parentKey))
      )

    case 'object':
      return resolveObject(schema, lookup)

    case 'union':
      return resolveUnion(schema, lookup, parentKey)

    case 'const':
      return resolveConst(schema, lookup, parentKey)

    default:
      return resolveLeaf(schema, lookup, parentKey)
  }
}

function resolveObject(schema: Schema, lookup: MessageLookup): Schema {
  const dict = (schema as any).dict as Record<string, Schema> | undefined
  if (!dict) return schema

  // Resolve group title from common prefix
  const keys = Object.keys(dict)
  const prefix = findCommonPrefix(keys)
  const clone = cloneSchema(schema)
  if (prefix) {
    const groupTitle = lookup(`prefs.${prefix}.$title`) ?? lookup(`prefs.${prefix}.$`) // LEGACY: remove after i18n repo migrates `$` → `$title`
    if (groupTitle) {
      clone.meta.description = groupTitle
    }
  }

  // Resolve each field
  const newDict: Record<string, Schema> = {}
  for (const [key, fieldSchema] of Object.entries(dict)) {
    const resolved = resolveLeaf(fieldSchema, lookup, key)
    // Recurse into union/intersect children
    if (resolved.type === 'union' || resolved.type === 'intersect') {
      newDict[key] = resolvePreferenceI18n(resolved, lookup, key)
    } else {
      newDict[key] = resolved
    }
  }
  ;(clone as any).dict = newDict

  return clone
}

function resolveUnion(schema: Schema, lookup: MessageLookup, parentKey?: string): Schema {
  const list = (schema as any).list as Schema[] | undefined
  if (!list) return schema

  return cloneWithList(schema, (items) =>
    items.map((s) => {
      if (s.type === 'const') {
        return resolveConst(s, lookup, parentKey)
      }
      return resolvePreferenceI18n(s, lookup, parentKey)
    })
  )
}

function resolveConst(schema: Schema, lookup: MessageLookup, parentKey?: string): Schema {
  // Skip non-primitive const values (e.g. JSX nodes)
  const value = (schema as any).value
  if (value != null && typeof value === 'object') return schema

  if (!parentKey) return schema
  const i18nKey = `prefs.${parentKey}.${value}`
  const resolved = lookup(i18nKey)
  if (resolved) {
    const clone = cloneSchema(schema)
    clone.meta.description = resolved
    return clone
  }
  return schema
}

function resolveLeaf(schema: Schema, lookup: MessageLookup, parentKey?: string): Schema {
  if (!parentKey) return schema
  const i18nKey = `prefs.${parentKey}`
  // Lookup order: bare key → `.$label` → legacy fallbacks
  const resolved =
    lookup(i18nKey) ??
    lookup(`${i18nKey}.$label`) ??
    lookup(`${i18nKey}.description`) ?? // LEGACY: remove after i18n repo migrates `.description` → `.$label`
    lookup(`${i18nKey}.$`) // LEGACY: remove after i18n repo migrates `$` → `$title`/`$label`
  if (resolved) {
    const clone = cloneSchema(schema)
    clone.meta.description = resolved
    return clone
  }
  return schema
}

function cloneSchema(schema: Schema): Schema {
  // Schema instances are callable functions — a plain Object.create() clone
  // would produce a non-callable object that fails schemastery-form's
  // isSchemaInstance check (`typeof input === 'function'`).
  // Wrap the original call behavior and copy all own properties.
  const clone: any = function (this: any, ...args: any[]) {
    return (schema as any).apply(this, args)
  }
  Object.setPrototypeOf(clone, Object.getPrototypeOf(schema))
  Object.assign(clone, schema)
  clone.meta = { ...schema.meta }
  return clone
}

function cloneWithList(schema: Schema, transform: (list: Schema[]) => Schema[]): Schema {
  const list = (schema as any).list as Schema[] | undefined
  if (!list) return schema
  const clone = cloneSchema(schema)
  ;(clone as any).list = transform(list)
  return clone
}

function findCommonPrefix(keys: string[]): string {
  if (keys.length === 0) return ''
  // Extract first segment of each key (before the first dot)
  const prefixes = keys.map((k) => {
    const dot = k.indexOf('.')
    return dot >= 0 ? k.slice(0, dot) : k
  })
  // Return common prefix if all keys share the same first segment
  const first = prefixes[0]
  return prefixes.every((p) => p === first) ? first : ''
}
