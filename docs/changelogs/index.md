---
title: 更新日志
---

# InPageEdit NEXT 更新日志

<script setup lang="ts">
import Timeline from '@/.vitepress/components/Timeline/Timeline.vue'
import TimelineItem from '@/.vitepress/components/Timeline/TimelineItem.vue'
import TimelinePeriod from '@/.vitepress/components/Timeline/TimelinePeriod.vue'
</script>

## 前瞻预览版 <Badge>v0.x.x</Badge>

<Timeline title-tag='h3'>

<!-- template for future use

<TimelineItem info='Coming Soon' time='' title='x.x.x'>

...

</TimelineItem>

-->

<TimelineItem info='Coming Soon' time='' title='0.4.0'>

- perf!: replace cordis with @cordisjs/core
  - 我们用 [@cordisjs/core](https://www.npmjs.com/package/@cordisjs/core) 替换了对 Cordis 完整包的依赖，大幅减小了打包体积。
- feat: add log level configuration
  - 现在你可以通过配置项 `logLevel` 来控制日志输出的详细程度了。
  - 可选值是 `enum LoggerLevelRank`（`debug = 0`, `info = 1`, `warn = 2`, `error = 3`, `silent = 4`）。
  - 默认情况下，开发环境下日志级别为 `0`，生产环境下为 `1`。嫌吵的话可以调高点。

</TimelineItem>

<TimelineItem time='2025-09-28T22:27:55.339Z' title='0.3.1'>

- fix: wrong states check for build format
  - 修正了是否自动导入 css 的错误判断
- fix: wrong `__VERSION__` constant in build
  - 修正了打包时插入的错误版本号常量
- feat!: introduce schemastery-form
  - 我们已从 @inpageedit/core 中解耦出表单组件，发布并开源了独立的新包 [schemastery-form](https://www.npmjs.com/package/schemastery-form)。

</TimelineItem>

<TimelineItem time='2025-09-28T19:03:39.511Z' title-id='0.3.0'>

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

</TimelineItem>

<TimelineItem time='2025-09-27T04:42:04.339Z' title='0.2.0'>

- chore: publish with types declaration
- fix: ResourceLoader load relative path

</TimelineItem>

<TimelineItem time='2025-09-25T14:44:33.824Z' title='0.1.1'>

- feat: add bundled pack

</TimelineItem>

<TimelineItem time='2025-09-24T10:52:35.505Z' title='0.1.0'>

- feat: 🎉 First release

</TimelineItem>

</Timeline>
