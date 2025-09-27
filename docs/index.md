---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: 'InPageEdit NEXT'
  text: 'For MediaWiki'
  tagline: '🚀 模块化、可扩展的 MediaWiki 超级增强插件'
  # image:
  #   src: /images/logo/InPageEdit.png
  #   alt: InPageEdit Logo
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/
    - theme: alt
      text: 插件列表
      link: /plugins/
    - theme: alt
      text: 参与开发 & 自定义插件
      link: /development/

features:
  - title: 快速编辑
    icon: 🚀
    details: 无需打开新标签页即可快速编辑、移动、重定向页面，大幅提升维护效率
  - title: 模块化设计
    icon: 🔧
    details: 完全使用 TypeScript 编写，支持热插拔插件，代码结构清晰，易于扩展
  - title: 丰富的功能
    icon: 📦
    details: 快速差异对比、页面预览、批量操作等多项实用功能，满足各种编辑需求
  - title: 简单易用
    icon: 🎯
    details: 一键安装，自动加载，无需复杂配置即可享受所有功能
  - title: 插件生态
    icon: 🔌
    details: 强大的插件系统，支持自定义功能扩展，社区提供丰富的插件资源
  - title: 国际化支持
    icon: 🌐
    details: 支持多语言界面，适配不同语言的 MediaWiki 站点
---

<script setup>
import { data } from './version.data.js'
</script>

<div style="text-align: center; margin-top: 2rem;">
最新版本：<Badge type="tip">{{ data.npmVersion }}</Badge>，开发版本：<Badge type="warning">{{ data.devVersion }}</Badge>
</div>

<!-- @include: @/.templates/install-personal.md -->
