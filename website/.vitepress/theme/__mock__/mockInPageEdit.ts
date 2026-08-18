import { InPageEdit } from '@inpageedit/core'
import '@inpageedit/core/style.css'
import { createMockIPE } from '../../../../packages/core/dev/__mock__/createMockIPE.js'

import type {} from '@inpageedit/core/plugins'

export const useMockInPageEdit = () => {
  const ipe = createMockIPE(InPageEdit)

  ipe.on('quick-edit/edit-notice', ({ editNotices }) => {
    const notice = document.createElement('div')
    notice.innerHTML =
      "This is a simulated interface. Feel free to click the Save button -- it won't break anything."
    notice.style.cssText =
      'background: #f0f0f0; border-radius: 0.5em; margin-bottom: 1em; color: #333; border-left: 6px solid #007bff; padding: 0.5em; padding-left: 1.5em; font-size: 14px;'
    editNotices.unshift(notice)
  })

  // Dispose analytics plugin to prevent sending data in docs site
  ipe.inject(['analytics', 'storage'], async (ctx) => {
    await ctx.storage.simpleKV.set('analytics/confirm-shown', 1)
    ctx.analytics.ctx.scope.dispose()
  })

  ipe.start().then(() => {
    ipe
      .logger('AUTOLOAD')
      .info(
        '\n' +
          '    ____      ____                   ______    ___ __ \n   /  _/___  / __ \\____ _____ ____  / ____/___/ (_) /_\n   / // __ \\/ /_/ / __ `/ __ `/ _ \\/ __/ / __  / / __/\n _/ // / / / ____/ /_/ / /_/ /  __/ /___/ /_/ / / /_  \n/___/_/ /_/_/    \\__,_/\\__, /\\___/_____/\\__,_/_/\\__/  \n                      /____/                v' +
          ipe.version
      )
  })

  return ipe
}
