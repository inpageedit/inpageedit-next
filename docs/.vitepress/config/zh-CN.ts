import { defineConfig } from 'vitepress'

export default defineConfig({
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '指南', link: '/guide/' },
      { text: '插件', link: '/plugins/' },
      { text: '开发', link: '/development/' },
    ],
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
