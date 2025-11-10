import type {} from 'schemastery'

declare global {
  namespace Schemastery {
    interface Meta<T = any> {
      /** Category grouping for UI or docs */
      category?: string
      hidden?: boolean
    }
  }
}
