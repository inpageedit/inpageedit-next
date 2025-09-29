import { defineCustomElement } from 'vue'
import MBoxVue, { type MBoxProps } from './MBox.ce.vue'
import { JSX } from 'jsx-dom/jsx-runtime'
import { DetailedHTMLProps, h, HTMLAttributes, ReactNode } from 'jsx-dom'

const HTMLMBoxElement = defineCustomElement(MBoxVue)

registerCustomElement('ipe-mbox', HTMLMBoxElement)

declare global {
  interface HTMLElementTagNameMap {
    'ipe-mbox': InstanceType<typeof HTMLMBoxElement>
  }
}

declare module 'jsx-dom' {
  namespace JSX {
    interface IntrinsicElements {
      'ipe-mbox': DefineJSXCustomElement<MBoxProps>
    }
  }
}

/**
 * 工厂函数：保持与原先的 JSX / 函数式创建 API 兼容。
 * 使用方式：MBox({ type, title, content, closeable, children })
 */
export const MBox = (props: MBoxProps & Omit<JSX.IntrinsicElements['div'], keyof MBoxProps>) => {
  const { type = 'default', title = '', content = '', closeable = true, children, ...rest } = props
  const el = h('ipe-mbox', props)
  return el
}
