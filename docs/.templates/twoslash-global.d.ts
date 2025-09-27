/// <reference types="types-mediawiki" />
/// <reference types="@inpageedit/core" />
/// <reference types="@types/jquery" />

import type { InPageEdit } from '@inpageedit/core'

import type {} from '@inpageedit/core/services/ApiService'
import type {} from '@inpageedit/core/services/SiteMetadataService'
import type {} from '@inpageedit/core/services/SsiModalService'
import type {} from '@inpageedit/core/services/WikiPageService'

import type {} from '@inpageedit/core/plugins/preferences/index'
import type {} from '@inpageedit/core/plugins/quick-edit/index'
import type {} from '@inpageedit/core/plugins/toolbox/index'

declare global {
  export const ctx: InPageEdit
}
