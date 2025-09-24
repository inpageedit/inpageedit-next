import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'InPageEdit NEXT',
  description: '🚀 Modular, Extensible Supercharged Plugin for MediaWiki',
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide' },
      { text: 'Plugins', link: '/plugins' },
      { text: 'Development', link: '/development' },
    ],

    sidebar: [
      {
        text: 'Guide',
        items: [{ text: 'Getting Started', link: '/guide' }],
      },
      {
        text: 'Plugins',
        items: [{ text: 'Hello World', link: '/plugins' }],
      },
      {
        text: 'Development',
        items: [{ text: 'Getting Started', link: '/development' }],
      },
    ],

    socialLinks: [{ icon: 'github', link: 'https://github.com/vuejs/vitepress' }],
  },
})
