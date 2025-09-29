import { InPageEdit } from '@/InPageEdit'
import { App, inject, provide } from 'vue'

export const IPEInjectKey = Symbol('IPEInjectKey')

export const injectIPE = (ipe: InPageEdit, app?: App) => {
  if (app) {
    app.provide(IPEInjectKey, ipe)
  } else {
    provide(IPEInjectKey, ipe)
  }
  return ipe
}

export const useIPE = () => {
  const ipe = inject<InPageEdit>(IPEInjectKey)
  if (!ipe) {
    throw new Error('InPageEdit instance is not provided')
  }
  return ipe
}
