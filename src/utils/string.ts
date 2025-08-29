export function capitalize(source: string) {
  return source.charAt(0).toUpperCase() + source.slice(1)
}

export function uncapitalize(source: string) {
  return source.charAt(0).toLowerCase() + source.slice(1)
}

export function camelCase(source: string) {
  return source.replace(/[_-][a-z]/g, (str) => str.slice(1).toUpperCase())
}

export function paramCase(source: string) {
  return uncapitalize(source)
    .replace(/_/g, '-')
    .replace(/.[A-Z]+/g, (str) => str[0] + '-' + str.slice(1).toLowerCase())
}

export function snakeCase(source: string) {
  return uncapitalize(source)
    .replace(/-/g, '_')
    .replace(/.[A-Z]+/g, (str) => str[0] + '_' + str.slice(1).toLowerCase())
}

export function trimSlash(source: string) {
  return source.replace(/\/+$/, '')
}

export function ensureSlash(source: string) {
  return source.endsWith('/') ? source : source + '/'
}
