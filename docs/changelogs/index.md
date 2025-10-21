---
title: 更新日志
---

# InPageEdit NEXT 更新日志

<script setup lang="ts">
import Timeline from '@/.vitepress/components/Timeline/Timeline.vue'
import ChangeLog from '@/.vitepress/components/ChangeLog.vue'
</script>

## 前瞻预览版 <Badge>v0.x.x</Badge>

<Timeline title-tag='h3'>

<!-- template for future use

<ChangeLog version='x.x.x'>

- 更新了依赖，修复了一些小问题，提升了项目的整体质量。

</ChangeLog>

-->

<ChangeLog version='0.5.4'>

- 更新了依赖，修复了一些小问题，提升了项目的整体质量。

</ChangeLog>

<ChangeLog version='0.5.3'>

- chore: improve toolbox styles
  - 优化了工具盒™的样式，它看起来更有趣了！
- refactor: dynamically calculating toolbox transition-delay
  - 动态计算按钮的动画间延迟，现在创建无数个按钮也能获得非线性动画效果！
- fix: modal.notify logic, improve modal css
  - 优化了吐司通知的逻辑以及样式，终于不是一片雪白了！
- fix: schema value race condition
  - 修复了参数设置中，修改文本框内容时总是丢失焦点的问题
- chore: batch improvements
  - 修复了一些小问题，提升了项目的整体质量

</ChangeLog>

<ChangeLog version='0.5.2'>

- chore: minor css adjustments
- chore!: normalize event names
  - 我们调整了官方插件的事件名称，统一了事件名称的命名规范。
  - 完整的调整列表：
    - `quickEdit/initOptions` -> `quick-edit/init-options`
    - `quickEdit/showModal` -> `quick-edit/show-modal`
    - `quickEdit/wikiPage` -> `quick-edit/wiki-page`
    - `quickPreview/showModal` -> `quick-preview/show-modal`
    - `quickPreview/loaded` -> `quick-preview/loaded`
    - `toolbox/button/added` -> `toolbox/button-added`
    - `toolbox/button/removed` -> `toolbox/button-removed`

</ChangeLog>

<ChangeLog version='0.5.1'>

- fix: edit section should not replace fulltext
  - 段落编辑不再覆盖全文内容
- chore: minor css improvements
  - 优化了部分组件的布局

</ChangeLog>

<ChangeLog version='0.5.0'>

<template #title>0.5.0 <Badge type='rainbow'>重量级</Badge></template>

- refactor!: drop jquery, drop ssi-modal
  - 我们完全抛弃了对 jQuery 和 ssi-modal 的依赖，使用原生 DOM API 和 CSS 来实现 Modal 服务。
  - 我们计划在不久的将来解耦并发布该轻量级 modal 库。
- feat: + ipe-next logos
  - 我们彻底重新设计了[InPageEdit Logos](../about/logo.md)！
- chore: batch improvements
  - feat(schemastery-form): transition for array/dict reorder
  - feat(schemastery-form): const support raw-html
  - feat(schemastery-form): add support for date/time/datetime
  - chore(core): IPEModal batch improvements

</ChangeLog>

<ChangeLog version='0.4.1'>

- chore: housekeeping
  - 更新了依赖，修复了一些小问题，提升了项目的整体质量
  - 将部分核心服务标记为 `builtin`，以便在不声明注入时也能直接使用：`api`, `resourceLoader`, `modal`, `storage`, `sitemeta`, `wikiPage`
- refactor!: replace logger with @inpageedit/logger
  - 我们解耦并发布了我们的简单、强大、可扩展的 Logger 库：[@inpageedit/logger](https://www.npmjs.com/package/@inpageedit/logger)

</ChangeLog>

<ChangeLog version='0.4.0'>

- perf!: replace cordis with @cordisjs/core
  - 我们用 [@cordisjs/core](https://www.npmjs.com/package/@cordisjs/core) 替换了对 Cordis 完整包的依赖，大幅减小了打包体积。
- feat: add log level configuration
  - 现在你可以通过配置项 `logLevel` 来控制日志输出的详细程度了。
  - 可选值是 `enum LoggerLevelRank`（`debug = 0`, `info = 1`, `warn = 2`, `error = 3`, `silent = 4`）。
  - 默认情况下，开发环境下日志级别为 `0`，生产环境下为 `1`。嫌吵的话可以调高点。

</ChangeLog>

<ChangeLog version='0.3.2'>

- fix: ensure autoload run once
  - 修正了自动加载功能可能被多次触发的问题

</ChangeLog>

<ChangeLog version='0.3.1'>

- fix: wrong states check for build format
  - 修正了是否自动导入 css 的错误判断
- fix: wrong `__VERSION__` constant in build
  - 修正了打包时插入的错误版本号常量
- feat!: introduce schemastery-form
  - 我们解耦并发布了开箱即用、体积小巧的 [schemastery-form](https://www.npmjs.com/package/schemastery-form)。

</ChangeLog>

<ChangeLog version='0.3.0'>

<template #title>0.3.0 <Badge type='rainbow'>重量级</Badge></template>

- refactor!: drop naive-ui, rewrite SchemaForm to WebComponent
  - 我们抛弃了对 Naive UI 的依赖，转而使用原生 WebComponent 来实现 SchemaForm 组件。
  - 这使得 PreferencesForm 组件的打包体积大幅缩小为原来的 **1/10**！
- refactor!: make monorepo
  - 现在 InPageEdit NEXT 采用了 Monorepo 结构，核心功能被拆分到 `@inpageedit/core` 包中。
- docs: update documentation
  - 文档中心现在更加炫酷了！
- chore: project housekeeping
  - 更新了依赖，修复了一些小问题，提升了项目的整体质量。

</ChangeLog>

<ChangeLog version='0.2.0'>

- chore: publish with types declaration
- fix: ResourceLoader load relative path

</ChangeLog>

<ChangeLog version='0.1.1'>

- feat: add bundled pack

</ChangeLog>

<ChangeLog version='0.1.0'>

- feat: 🎉 First release

</ChangeLog>

</Timeline>
