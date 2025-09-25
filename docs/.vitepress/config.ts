import { defineConfig } from 'vitepress'
import { generateSidebar } from 'vitepress-sidebar'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  base: process.env.DOCS_BASE_URL || '/',
  title: 'InPageEdit NEXT',
  description: '🚀 Modular, Extensible Supercharged Plugin for MediaWiki',

  locales: {
    root: {
      label: '简体中文',
      lang: 'zh-CN',
      // https://vitepress.dev/reference/default-theme-config
      themeConfig: {
        nav: [
          { text: '首页', link: '/' },
          { text: '指南', link: '/guide/' },
          { text: '插件', link: '/plugins/' },
          { text: '开发', link: '/development/' },
        ],

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
      },
    },
  },
  themeConfig: {
    socialLinks: [
      {
        icon: 'qq',
        link: 'https://qm.qq.com/q/Kpk147N8E8',
      },
      { icon: 'npm', link: 'https://www.npmjs.com/package/@inpageedit/core' },
      { icon: 'github', link: 'https://github.com/inpageedit/inpageedit-next' },
    ],
    footer: {
      copyright: `InPageEdit-NEXT Copyright © 2025-${new Date().getFullYear()} dragon-fish`,
    },
  },
})
