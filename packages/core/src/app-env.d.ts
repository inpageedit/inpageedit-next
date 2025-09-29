/// <reference types="vite/client" />
/// <reference types="types-mediawiki" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare global {
  import { DetailedHTMLProps, HTMLAttributes } from 'jsx-dom'
  export type DefineJSXCustomElement<
    P = {},
    E extends HTMLElement = HTMLElement,
  > = DetailedHTMLProps<Omit<HTMLAttributes<E>, keyof P> & P, E>
}

export {}
