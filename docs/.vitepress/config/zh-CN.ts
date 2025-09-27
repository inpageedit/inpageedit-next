import { defineConfig } from 'vitepress'
import { generateSidebar } from 'vitepress-sidebar'

export default defineConfig({
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '指南', link: '/guide/' },
      { text: '插件', link: '/plugins/' },
      {
        text: '开发',
        activeMatch: '/development/',
        items: [
          { text: '开发者指南', link: '/development/' },
          { text: '插件开发手把手', link: '/development/plugins-101/1.first-plugin' },
          { text: '参与核心开发', link: '/development/contribute-to-core/1.start' },
          { text: 'API参考', link: '/development/api-references/' },
        ],
      },
    ],
    // https://github.com/jooy2/vitepress-sidebar
    sidebar: generateSidebar({
      debugPrint: true,
      useTitleFromFileHeading: true,
      useTitleFromFrontmatter: true,
      useFolderTitleFromIndexFile: true,
      useFolderLinkFromIndexFile: true,
      manualSortFileNameByPriority: [
        // 用户指南
        'guide',
        // 插件列表
        'plugins',
        // 开发指南
        'development',
        'plugins-101',
        'contribute-to-core',
        'api-references',
      ],
    }),
    socialLinks: [
      {
        icon: 'qq',
        link: 'https://qm.qq.com/q/Kpk147N8E8',
      },
      { icon: 'npm', link: 'https://www.npmjs.com/package/@inpageedit/core' },
      { icon: 'github', link: 'https://github.com/inpageedit/inpageedit-next' },
    ],
    editLink: {
      text: '编辑此页',
      pattern: 'https://github.com/inpageedit/inpageedit-next/edit/master/docs/:path',
    },
  },
})
