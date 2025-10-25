import { InPageEdit } from '@inpageedit/core'
import '@inpageedit/core/style.css'
import { MOCK_API_ENDPOINT_URL, mockFetch } from './mockMwApi.ts'
import { useMockMwConfig } from './mockMwConfig.ts'
import { MockMwHook } from './mockMwGlobal.ts'

import type {} from '@inpageedit/core/plugins/quick-edit/index'
import type {} from '@inpageedit/core/plugins/toolbox/index'

export const useMockInPageEdit = () => {
  window.mw = window.mw || {}
  ;(window.mw as any).config = useMockMwConfig()
  ;(window.mw as any).hook = (name: string) => {
    return MockMwHook.create(name)
  }
  // @ts-ignore fake hook add method
  window.mw.hook('InPageEdit.ready').add = (...handlers) => {
    handlers.forEach((fn) => {
      fn(ipe)
    })
  }

  const ipe = new InPageEdit({
    autoloadStyles: false,
    apiConfigs: {
      baseURL: MOCK_API_ENDPOINT_URL.toString(),
      fetch: mockFetch,
    },
  })

  ipe.on('quick-edit/edit-notice', ({ editNotices }) => {
    const notice = document.createElement('div')
    notice.innerHTML =
      "This is a simulated interface. Feel free to click the Save button -- it won't break anything."
    notice.style.cssText =
      'background: #f0f0f0; border-radius: 0.5em; margin-bottom: 1em; color: #333; border-left: 6px solid #007bff; padding: 0.5em; padding-left: 1.5em; font-size: 14px;'
    editNotices.unshift(notice)
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
