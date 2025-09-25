import { defineConfig } from 'vitepress'
import { generateSidebar } from 'vitepress-sidebar'
import { withMermaid } from 'vitepress-plugin-mermaid'
import { UserConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config

export default defineConfig(
  withMermaid({
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
      // https://github.com/jooy2/vitepress-sidebar
      sidebar: generateSidebar({
        documentRootPath: 'docs',
        debugPrint: true,
        useTitleFromFileHeading: true,
        useTitleFromFrontmatter: true,
        useFolderTitleFromIndexFile: true,
        useFolderLinkFromIndexFile: true,
        manualSortFileNameByPriority: ['guide', 'plugins', 'development'],
      }),

      socialLinks: [
        { icon: 'npm', link: 'https://www.npmjs.com/package/@inpageedit/core' },
        { icon: 'github', link: 'https://github.com/inpageedit/inpageedit-next' },
      ],
      footer: {
        message: '✏️ InPageEdit NEXT',
        copyright: `Copyright © 2025-present <a href="https://github.com/dragon-fish" target="_blank">Dragon Fish</a>`,
      },
      search: {
        provider: 'local',
      },
    },

    markdown: {
      async shikiSetup(shiki) {
        await shiki.loadLanguage('wikitext')
      },
    },

    lastUpdated: true,
    sitemap: {
      hostname: 'https://www.ipe.wiki',
    },

    vite: {
      server: {
        port: 1225,
      },
    },
  })
)
