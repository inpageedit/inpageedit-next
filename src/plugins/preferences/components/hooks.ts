import { InPageEdit } from '@/InPageEdit'
import { inject } from 'vue'

export const IPEInjectKey = Symbol('IPEInjectKey')

export const useIPE = () => {
  return inject<InPageEdit>(IPEInjectKey)
}
