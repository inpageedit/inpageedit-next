import { defineCustomElement } from 'vue'
import ProgressBarVue, { type ProgressBarProps } from './ProgressBar.ce.vue'
import { h } from 'jsx-dom'

const ProgressBarElement = defineCustomElement(ProgressBarVue)
registerCustomElement('ipe-progress-bar', ProgressBarElement)

declare global {
  interface HTMLElementTagNameMap {
    'ipe-progress-bar': InstanceType<typeof ProgressBarElement>
  }
}

declare module 'jsx-dom' {
  namespace JSX {
    interface IntrinsicElements {
      'ipe-progress-bar': DefineJSXCustomElement<ProgressBarProps>
    }
  }
}

// 兼容旧函数式调用：ProgressBar({...}) 返回元素实例
export const ProgressBar = (attrs: ProgressBarProps) => {
  const el = h('ipe-progress-bar')
  if (typeof attrs?.progress === 'number') {
    el.progress = attrs.progress
    el.indeterminate = false
  } else if (typeof attrs.indeterminate !== 'undefined') {
    el.indeterminate = !!attrs.indeterminate
  }
  return el
}
