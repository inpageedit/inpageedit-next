import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'
import {
  GitChangelog,
  GitChangelogMarkdownSection,
} from '@nolebase/vitepress-plugin-git-changelog/vite'
import { InlineLinkPreviewElementTransform } from '@nolebase/vitepress-plugin-inline-link-preview/markdown-it'
import {
  PageProperties,
  PagePropertiesMarkdownSection,
} from '@nolebase/vitepress-plugin-page-properties/vite'
import { transformerTwoslash } from '@shikijs/vitepress-twoslash'
// @ts-ignore
import taskLists from 'markdown-it-task-lists'
import timeline from 'vitepress-markdown-timeline'
import {
  groupIconMdPlugin,
  groupIconVitePlugin,
  localIconLoader,
} from 'vitepress-plugin-group-icons'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import ts from 'typescript'

const GITHUB_REPO_URL = 'https://github.com/inpageedit/inpageedit-next'

const twoSlashDts = await readFile(
  resolve(import.meta.dirname, '../../.templates/twoslash-global.d.ts'),
  'utf-8'
)

// https://vitepress.dev/reference/site-config
export default withMermaid(
  defineConfig({
    base: process.env.DOCS_BASE_URL || '/',
    title: 'InPageEdit NEXT',
    description: '🚀 Modular, Extensible Supercharged Plugin for MediaWiki',

    locales: {
      root: {
        label: '简体中文',
        lang: 'zh-CN',
        ...(await import('./zh-CN.js')).default,
      },
    },
    themeConfig: {
      logo: '/images/logo/ipe-uwu.png',
      outline: {
        level: [2, 3],
      },
      socialLinks: [
        { icon: 'npm', link: 'https://www.npmjs.com/package/@inpageedit/core' },
        { icon: 'github', link: GITHUB_REPO_URL },
      ],
      footer: {
        message: '✏️ InPageEdit NEXT',
        copyright: `Copyright © 2025-present <a href="https://github.com/dragon-fish" target="_blank">Dragon Fish</a>`,
      },
      search: {
        provider: 'algolia',
        options: {
          appId: 'KRIUP3MXAF',
          indexName: 'IPE NEXT Docs',
          apiKey: '93a6f9f7845826528098263676ea95ed',
        },
      },
    },

    head: [
      // Algolia site verification
      ['meta', { name: 'algolia-site-verification', content: '17034004E7860468' }],
    ],

    markdown: {
      config: (md) => {
        md.use(timeline)
        md.use(taskLists)
        md.use(InlineLinkPreviewElementTransform)
        md.use(groupIconMdPlugin)
      },
      codeTransformers: [
        // {
        //   name: 'twoslash-inject-global-dts',
        //   enforce: 'pre',
        //   preprocess(code, options) {
        //     this.meta.twoslash?.meta
        //     console.info(code, options)
        //     return code
        //   },
        // },
        transformerTwoslash({
          twoslashOptions: {
            extraFiles: {
              'twoslash-global.d.ts': twoSlashDts,
            },
            compilerOptions: {
              target: ts.ScriptTarget.ES2020,
              module: ts.ModuleKind.ESNext,
              moduleResolution: ts.ModuleResolutionKind.Bundler,
              strict: true,
              noImplicitAny: true,
              skipLibCheck: true,
              jsx: ts.JsxEmit.ReactJSX,
              jsxImportSource: 'jsx-dom',
            },
          },
          floatingVue: {},
          throws: false,
          onTwoslashError(error, code, lang, options) {
            console.error('[TwoSlashError]', error, code, lang)
          },
        }),
      ],
      languages: ['js', 'jsx', 'ts', 'tsx', 'wiki', 'json', 'css', 'html', 'bash'],
    },

    lastUpdated: true,
    cleanUrls: true,
    metaChunk: true,
    sitemap: {
      hostname: 'https://www.ipe.wiki',
    },

    ignoreDeadLinks: true,
    vue: {
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag.startsWith('schema-'),
        },
      },
    },
    vite: {
      plugins: [
        groupIconVitePlugin({
          customIcon: {
            'gadgets-definition': localIconLoader(import.meta.url, '../public/icons/mediawiki.svg'),
          },
        }),
        GitChangelog({
          maxGitLogCount: 100,
          repoURL: () => GITHUB_REPO_URL,
        }),
        GitChangelogMarkdownSection({}),
        PageProperties(),
        PagePropertiesMarkdownSection({}),
      ],
      resolve: {
        alias: {
          '@': resolve(import.meta.dirname, '../../'),
          '#': resolve(import.meta.dirname, '../'),
          $: resolve(import.meta.dirname, '../components'),
        },
      },
      optimizeDeps: {
        exclude: ['@nolebase/vitepress-plugin-inline-link-preview/client'],
      },
      ssr: {
        noExternal: ['@nolebase/vitepress-plugin-inline-link-preview'],
      },
      publicDir: resolve(import.meta.dirname, '../public'),
      server: {
        port: 1225,
      },
    },
  })
)
