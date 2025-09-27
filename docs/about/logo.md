<script setup lang="ts">
import Gallery from '@/.vitepress/components/Gallery.vue'
import ColorPreview from '@/.vitepress/components/ColorPreview.vue'

const logos = [
  {
    src: '/images/logo/InPageEdit.png',
    alt: 'InPageEdit',
  },
  {
    src: '/images/logo/IPE.png',
    alt: 'IPE',
  },
  {
    src: '/images/logo/InPageEdit-v2.png',
    alt: 'InPageEdit-v2',
  },
  {
    src: '/images/logo/IPE-v2.png',
    alt: 'IPE-v2',
  },
]
</script>

# 关于 Logo

<Gallery :items="logos" />

[Dianliang233](https://github.com/dianliang233/) 使用 [Sketch](https://www.sketch.com/) 制作

## 设计&字体

- 色卡：[Atlassian Design](https://atlassian.design/)
  - In: Pacific Bridge B400 (<ColorPreview color="#0052CC" />)
  - Page: Sodium Explosion B300 (<ColorPreview color="#0065FF" />)
  - Edit: Coogee B200 (<ColorPreview color="#2684FF" />)
- Edit 中的字母 i：
  <svg fill="currentColor" style="width: 40px;" class="MuiSvgIcon-root jss67" focusable="false" viewBox="0 0 24 24" aria-hidden="true" tabindex="-1" title="Edit" data-ga-event-category="material-icons" data-ga-event-action="click" data-ga-event-label="Edit"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"></path></svg>

  来自 [Material Design Icon](https://material.io/resources/icons/)

- 字体：Google "Product" Sans
