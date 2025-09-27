import { defineConfig } from 'vitepress'
import { generateSidebar } from 'vitepress-sidebar'

export default defineConfig({
  themeConfig: {
    nav: [
      {
        text: '指南',
        activeMatch: '/guide/',
        items: [
          { text: '用户指南', link: '/guide/' },
          { text: '安装方法', link: '/guide/installation' },
        ],
      },
      {
        text: '插件',
        activeMatch: '/plugins/',
        items: [{ text: '插件中心', link: '/plugins/' }],
      },
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
      {
        text: '更多',
        activeMatch: '/about/',
        items: [
          {
            text: '关于我们',
            link: '/about/',
          },
          { text: '更新日志', link: '/changelogs/' },
          { text: '关于 Logo', link: '/about/logo' },
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
        'installation.md',
        // 插件列表
        'plugins',
        // 开发指南
        'development',
        'plugins-101',
        'contribute-to-core',
        'api-references',
        'about',
        'changelogs',
      ],
      excludeByGlobPattern: ['README.md'],
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
