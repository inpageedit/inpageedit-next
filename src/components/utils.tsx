import { CSSProperties, ReactElement } from 'jsx-dom'

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
    } else if (typeof value === 'string' && value.endsWith('!important')) {
      // @ts-ignore
      el.style.setProperty(key, value.replace('!important', '').trim(), 'important')
    } else {
      // @ts-ignore
      el.style[key] = value
    }
  })
  return el
}
