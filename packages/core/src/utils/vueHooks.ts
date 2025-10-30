import { InPageEdit } from '@/InPageEdit'
import { App, createApp, inject, provide } from 'vue'

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

export const createVueAppWithIPE = (ipe: InPageEdit, ...args: Parameters<typeof createApp>) => {
  const app = createApp(...args)
  injectIPE(ipe, app)
  return app
}
