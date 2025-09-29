import { CSSProperties, DetailedHTMLProps, HTMLAttributes, ReactElement } from 'jsx-dom'

export const qs = <T extends Element>(
  selector: string,
  parent: HTMLElement | Document = document
) => {
  return parent.querySelector(selector) as T | null
}
export const qsa = <T extends Element>(
  selector: string,
  parent: HTMLElement | Document = document
) => {
  return parent.querySelectorAll(selector) as NodeListOf<T>
}

export const setStyles = (el: HTMLElement | ReactElement, style: CSSProperties) => {
  Object.entries(style).forEach(([key, value]) => {
    if (typeof value === 'undefined' || value === null) {
      el.style.removeProperty(key)
    } else {
      const isImportant = typeof value === 'string' && value.endsWith('!important')
      // @ts-ignore
      el.style.setProperty(
        key,
        value.replace('!important', '').trim(),
        isImportant ? 'important' : undefined
      )
    }
  })
  return el
}

export const setPropertys = (el: HTMLElement | ReactElement, props: Record<string, any>) => {
  Object.entries(props).forEach(([key, value]) => {
    const hasProp = Reflect.has(el, key)
    if (hasProp) {
      // @ts-ignore
      el[key] = value
    } else {
      if (typeof value === 'undefined' || value === null) {
        el.removeAttribute(key)
      } else {
        el.setAttribute(key, String(value))
      }
    }
  })
  return el
}

/**
 * 将字符串属性转换为布尔值，空字符串或缺失视为 true，"false"/"0" 为 false
 */
export const parseBooleanAttr = (value: string | null | undefined, defaultValue = true) => {
  if (value == null) return defaultValue
  const v = value.toLowerCase().trim()
  if (['false', '0', 'no', 'off', 'null', 'undefined'].includes(v)) return false
  return true
}

export const registerCustomElement = (name: string, constructor: CustomElementConstructor) => {
  if (!customElements.get(name)) {
    customElements.define(name, constructor)
  }
}
