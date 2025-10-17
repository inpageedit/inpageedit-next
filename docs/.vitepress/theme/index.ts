// https://vitepress.dev/guide/custom-theme
import { h } from 'vue'
import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'

import IpeVersion from '../components/IpeVersion.vue'

import 'virtual:group-icons.css'

import {
  InjectionKey as GitChangelogInjectionKey,
  NolebaseGitChangelogPlugin,
} from '@nolebase/vitepress-plugin-git-changelog/client'
import '@nolebase/vitepress-plugin-git-changelog/client/style.css'

import { NolebaseInlineLinkPreviewPlugin } from '@nolebase/vitepress-plugin-inline-link-preview/client'
import '@nolebase/vitepress-plugin-inline-link-preview/client/style.css'

import {
  NolebasePagePropertiesPlugin,
  InjectionKey as PagePropertiesInjectionKey,
} from '@nolebase/vitepress-plugin-page-properties'
import '@nolebase/vitepress-plugin-page-properties/client/style.css'

import TwoslashFloatingVue from '@shikijs/vitepress-twoslash/client'
import '@shikijs/vitepress-twoslash/style.css'

import 'vitepress-markdown-timeline/dist/theme/index.css'

import './style.scss'
import DateFormat from '../components/DateFormat.vue'

export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      // https://vitepress.dev/guide/extending-default-theme#layout-slots
    })
  },
  enhanceApp({ app, router, siteData }) {
    app.component('IpeVersion', IpeVersion)
    app.component('DateFormat', DateFormat)

    app.use(TwoslashFloatingVue)

    app.use(NolebaseGitChangelogPlugin)
    app.provide(GitChangelogInjectionKey, {
      hideChangelogNoChangesText: true,
      hideChangelogHeader: true,
      commitsRelativeTime: true,
      displayAuthorsInsideCommitLine: true,
    })

    app.use(NolebaseInlineLinkPreviewPlugin)

    app.use(NolebasePagePropertiesPlugin())
    app.provide(PagePropertiesInjectionKey, {
      properties: {
        'zh-CN': [
          {
            key: 'wordCount',
            type: 'dynamic',
            title: '字数',
            options: {
              type: 'wordsCount',
            },
          },
          {
            key: 'readingTime',
            type: 'dynamic',
            title: '阅读时间',
            options: {
              type: 'readingTime',
              dateFnsLocaleName: 'zhCN',
            },
          },
          {
            key: 'updatedAt',
            type: 'datetime',
            title: '更新时间',
            formatAsFrom: true,
            dateFnsLocaleName: 'zhCN',
          },
        ],
      },
    })

    // https://gtranslate.io/website-translator-widget
    if (typeof window !== 'undefined') {
      if (window.gtranslateSettings) return
      window.gtranslateSettings = {
        default_language: 'zh-CN',
        languages: ['zh-CN', 'en', 'fr', 'ru', 'de', 'ja'],
        native_language_names: true,
        wrapper_selector: '#gtranslate_wrapper',
        alt_flags: { en: 'usa' },
      }
      const container =
        document.getElementById('gtranslate_wrapper') ||
        (Object.assign(document.createElement('div'), {
          id: 'gtranslate_wrapper',
        }) as HTMLDivElement)
      document.body.appendChild(container)
      const script = Object.assign(document.createElement('script'), {
        src: 'https://cdn.gtranslate.net/widgets/latest/float.js',
        defer: true,
      })
      container.appendChild(script)
    }
  },
} satisfies Theme

declare global {
  interface Window {
    gtranslateSettings?: any
  }
}
