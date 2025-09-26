/// <reference types="types-mediawiki" />
/// <reference types="@inpageedit/core" />
/// <reference types="@types/jquery" />

import type { InPageEdit } from '@inpageedit/core'

import type {} from '@inpageedit/core/dist/services/ApiService'
import type {} from '@inpageedit/core/dist/services/SiteMetadataService'
import type {} from '@inpageedit/core/dist/services/SsiModalService'
import type {} from '@inpageedit/core/dist/services/WikiPageService'

import type {} from '@inpageedit/core/dist/plugins/preferences'
import type {} from '@inpageedit/core/dist/plugins/quick-edit'
import type {} from '@inpageedit/core/dist/plugins/toolbox'

declare global {
  export const ctx: InPageEdit
}

declare global {
  namespace mw {
    /**
     * @see https://doc.wikimedia.org/mediawiki-core/master/js/Hook.html
     * @see https://github.com/wikimedia-gadgets/types-mediawiki/blob/9b4e7c3b9034d64a44a0667229a6d9585fe09b30/mw/hook.d.ts
     */
    interface Hook<T extends any[] = any[]> {
      add(...handler: Array<(...data: T) => any>): this
      deprecate(msg: string): this
      fire(...data: T): this
      remove(...handler: Array<(...data: T) => any>): this
    }
    function hook(name: 'InPageEdit.ready'): Hook<[InPageEdit]>
  }
}
