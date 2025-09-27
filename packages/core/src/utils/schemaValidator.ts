import type Schema from 'schemastery'

export function schemaValidator(
  schema: Schema,
  value: any
): {
  status: 'success' | 'error'
  feedback: string
} {
  try {
    // Check value types
    const val = schema(value)

    // Check special roles
    switch (schema.meta.role) {
      case 'image-url':
      case 'url':
        if (checkURL(value) === 'error') {
          throw new TypeError('Invalid URL input')
        }
        break
    }

    // Check required value
    if (schema.meta.required) {
      switch (schema.type) {
        case 'string':
          if (value?.trim() === '') {
            throw new RangeError('This item can not be empty')
          }
          break
        case 'boolean':
          if (value === null) {
            throw new RangeError('A choice must be made')
          }
          break
      }
    }

    // OK
    return { status: 'success', feedback: '' }
  } catch (e: any) {
    // multiselect
    if (schema.type === 'union' && schema.meta.role === 'multiselect' && Array.isArray(value)) {
      return { status: 'success', feedback: '' }
    }

    console.warn('[SchemaItem] validate failed', { schema: schema, value: value }, e)
    return { status: 'error', feedback: e.toString() }
  }
}

/**
 * @returns `undefined` 空
 * @returns `success`   好
 * @returns `error`     孬
 */
export function checkURL(str: string, allowAllProtocal?: boolean) {
  if (!str) {
    return undefined
  }
  try {
    const url = new URL(str)
    if (allowAllProtocal || url.protocol.startsWith('http')) {
      return 'success'
    }
  } catch (_) {}
  return 'error'
}

export function openLinkPreview(url: string) {
  window.open(url, 'handleLinkPreview', 'centerscreen,chrome=yes,width=1200,height=800')
}
