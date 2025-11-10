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

<ChangeLog version='0.13.1'>

- 修复了一些小问题，提升了项目的整体质量。

</ChangeLog>

<ChangeLog version='0.13.0'>

此版本没有功能变动，主要优化了插件开发的体验。

- refactor(core): update package structure and enhance type definitions
- build(core): enhance types declaration

所有类型均可通过 `import type {} from '@inpageedit/core'` 单一入口导入，不再需要写一大堆 `import type {} from '@inpageedit/core/services/xxx'`。

</ChangeLog>

<ChangeLog version='0.12.1'>

- feat: user can uninstall broken plugins
  - 现在可以通过插件商店卸载损坏的插件了
- feat: enhance PluginStore with improved registry handling and caching
  - 优化了插件源的缓存和处理逻辑
- feat: prefs sync icons
  - 添加了偏好设置同步的图标
- refactor: PluginStoreApp structure
  - 重构了插件商店的结构
- style: enhance PluginStore components with improved UI and interactions
  - 优化了插件商店的组件的 UI 和 UX
- refactor: remove quick-delete plugin and update related interfaces
  - “快速删除”插件已不再内置，请前往插件商店下载
  - 新版快速删除插件支持批量删除

</ChangeLog>

<ChangeLog version='0.12.0'>

<template #title>0.12.0 <Badge type='rainbow'>重量级</Badge></template>

- <Badge type='rainbow'>新功能</Badge> feat: introduce PluginStore
  - 万众期待的 **插件商店** 终于来了！
  - 从工具盒™中点击齿轮按钮，切换到“Plugin Store”标签页，立即体验！
- feat: enhance PreferencesService with user-specific storage and migration from legacy database
  - 现在偏好设置按用户隔离存储，旧数据会自动迁移到更新后首个使用的用户下
- refactor!: + interface PreferencesMap
  - 重构了 `preferences.set/get` 的类型定义，开发者可以通过重载 `PreferencesMap` 接口来扩展偏好设置的类型，从而获得自动补全和类型检查。
  - ~~我爱类型体操~~
- refactor: PreferenceForm now no longer rerender full form
  - 现在 PreferenceFormApp 使用 `Schema.intersect` 来整合所有插件的配置构型，不再重新渲染整个表单，从而提升性能。
- fix: normalize button ID before removal in PluginToolbox
  - 修复了一个导致 `toolbox.removeButton` 无法正常移除按钮的问题
- feat: implement MemoryStorage, LocalStorageManager, given default kv entries
  - 实现了内存存储、本地存储管理器，并提供了默认的 KV 过滤器，方便开发者快速存储简单的数据。
- feat: enhance preferences UI with improved data presentation and user interactions
  - 优化了偏好设置的 UI，现在你可以更方便地管理插件的配置了！
  - `preferencesUI.defineCategory` 现在支持传递 `customRenderer` 来定制渲染器，从而在自动表单上方添加额外的自定义内容。
- feat: default reason for quick-delete, quick-move, and quick-redirect
  - 为快速删除、快速移动和快速重定向插件添加了默认理由配置项
- chore: housekeeping
  - 优化了大量 UI。
  - 更新了依赖，修复了一些小问题，提升了项目的整体质量。

</ChangeLog>

<ChangeLog version='0.11.1'>

- fix: isWikiLink should handle landing page
  - 修复了对 `$wgMainPageIsDomainRoot = true;` 的 wiki 中首页链接的错误判断
- feat: enhanced draggable modal
  - 简单优化了可拖拽模态框的样式

</ChangeLog>

<ChangeLog version='0.11.0'>

- fix: ensure consistent export order in PreferencesService
  - 导出配置时，确保键值对的顺序始终一致，以防出现不必要的差异。
- fix: quick-edit beforeunload
  - 修复了段落编辑时总是提示是否离开页面的问题。
- feat: + custom font option (#5 by @t7ru , #6 by @dragon-fish)
  - 添加了 `quickEdit.editFont` 配置项，现在你可以选择使用系统字体、等宽字体、sans-serif 字体或 serif 字体。
- feat: export prefs to file
  - 支持将偏好设置导出为 JSON 文件，方便备份和分享。
- refactor!: split siteinfo/userinfo caches
  - 将站点信息和用户信息缓存拆分为两个独立的缓存
  - 现在 userinfo 采用更短的缓存时间，以便更快地更新用户信息。
- feat: add event emissions for quick actions and update analytics endpoints
  - 补充了更多的触发事件
- feat: + PluginAnalytics
  - 添加了 Analytics 插件，现在可以选择加入统计数据收集，帮助我们更好地了解用户使用情况，优化产品设计，提升用户体验。

</ChangeLog>

<ChangeLog version='0.10.0'>

- feat: introduce idb-plus
  - 我们解耦并发布了我们的轻量级 IndexedDB 封装库：[idb-plus](https://www.npmjs.com/package/idb-plus)
  - `ctx.storage` 的用法与此前没有区别
- fix: prevent double namespaces
  - 修复了构造 WikiTitle 时 title 包含命名空间前缀时，重复添加命名空间前缀的问题
- fix: Special:Diff behavior (#4 by @AlPha5130)
  - 修正 `PluginInArticleLinks` 中针对特殊页面的 `diff` 和 `oldid` 提取逻辑，并在 `diff` 缺失时将其默认为 `prev`
- feat: + PluginPrefSync
  - 添加了偏好设置手动导入、导出功能
  - 我们将在未来提供真正的跨设备同步功能

</ChangeLog>

<ChangeLog version='0.9.3'>

- 修复了一些小问题，提升了项目的整体质量。

</ChangeLog>

<ChangeLog version='0.9.2'>

- refactor!: drop idb-keyval, using indexedDB native API
  - 我们完全抛弃了对 `idb-keyval` 以及 `localforage` 的依赖，直接使用原生 IndexedDB API 来实现 Storage 服务。
  - 这使得打包体积进一步减小了 ~2kb。
  - 我们决定在之后解耦并发布一个轻量级的 IndexedDB 封装库，以便其他项目使用。

</ChangeLog>

<ChangeLog version='0.9.1' style="text-decoration: line-through; opacity: 0.5;" info='UNPUBLISHED'>

> [!INFO]
>
> 由于 `idb-keyval` 上游问题，在同一数据库无法开启多个事务，导致 storage 服务异常，此版本完全无法使用，已撤销发布。

- refactor!: make preferences as a built-in service
  - `ctx.preferences` 从插件变成了内置服务
- chore!: drop diff.js
  - 移除了不再使用的 `diff`
- perf!: replace localforage with idb-keyval
  - 使用了 `idb-keyval` 替代 `localforage`，打包体积降低 ~40kb
- chore: housekeeping
  - 更新了依赖，修复了一些小问题，提升了项目的整体质量
  - `wiki-saikou@7.1.2`
  - `@inpageedit/modal@1.0.1`

</ChangeLog>

<ChangeLog version='0.9.0'>

- fix: invalid WikiMetadata cache key
  - 修正了一个导致 WikiMetadata 缓存失效的问题
- perf!: get endpoint by meta and link
  - 我们使用了一些魔法手段获取 MediaWiki 元信息，从而减少了对 `mw.config` 的依赖：
  - 通过 `<meta name="generator">` 判断是否为 MediaWiki 站点 + `<link rel="EditURI">` 获取 API endpoint
  - 通过 `<link rel="canonical">` 获取当前条目的永久链接，从而解析当前条目标题

</ChangeLog>

<ChangeLog version='0.8.1'>

- feat(modal)!: decouple and make it a standalone package
  - 我们解耦并发布了我们的轻量级模态框库：[@inpageedit/modal](https://www.npmjs.com/package/@inpageedit/modal)
  - `ctx.modal` 的用法与此前没有区别
- refactor!: +CurrentPageService
  - 我们完全抛弃了对于 `mw.config.get('wgPageName')`、`mw.config.get('wgArticleId')`、`mw.config.get('wgCurrentRevisionId')` 的依赖，完全使用当前的 URL + WikiMetadata 解析当前的页面基本信息
  - `currentPage.url` {URL} 当前页面 URL
  - `currentPage.params` {URLSearchParams} 当前页面 URL 参数
  - `currentPage.wikiAction` {string} 当前页面 Wiki 动作
  - `currentPage.wikiTitle` {WikiTitle} 当前页面标题实例
  - `currentPage.isMainPage` {boolean} 是否为 wiki 首页
- fix: specia:edit/newsection requires sub
  - 仅当 [[Special:Edit]] / [[Special:NewSection]] 链接拥有子页面部分时，才创建快速编辑按钮
- fix: parsing title includes special chars (?/&/...)
  - 修复了 wikiTitle.newTitleFromUrl 对包含特殊字符（`?`、`&`、`=`、...）的条目的错误解析
- chore: housekeeping
  - 更新了依赖，修复了一些小问题，提升了项目的整体质量。

</ChangeLog>

<ChangeLog version='0.8.0'>

- fix: wrong behavior of .ipe-modal-no-scroll
  - 锁定滚动时不会再错误修改 documentElement 的样式
- feat: modal button keyPress supports combos
  - 模态框按钮现在支持组合键触发（例如 `ctrl + s`）
  - 快速编辑等功能现已支持配置自定义快捷键
- refactor: add WikiPage factory, enhance type declarations
  - 将 `WikiPage` 模型重构为工厂函数，增强了类型声明
- perf: toolbox buttons check permissions
  - 工具盒™按钮现在会进行环境检查，避免在不可编辑的页面显示无效按钮
- refactor!: rename batch types (SiteFoo → WikiFoo)
  - 将所有 `SiteFoo` 类型重命名为 `WikiFoo`，以更好地反映其用途
- refactor!: rename service sitemeta → wiki
  - 将 `sitemeta` 服务重命名为 `wiki`，以更好地反映其用途
- feat!: add title parser to WikiTitleService
  - 我们为 `WikiTitleService` 添加了标题解析功能
  - 现在你可以使用 `wikiTitle.newTitleFromUrl(url)` 来从 URL 创建标题实例，并快速检查 URL 是否为本站链接
  - 添加了 `wikiTitle.currentTitle` getter，方便获取当前页面标题实例
- feat: add clear cache button for WikiMetadata
  - 你现在可以从设置页面清除 WikiMetadata 的缓存了
- feat: add toggle method for toolbox
  - 我们为工具盒™添加了切换显示/隐藏的方法 `toolbox.toggle()`，方便插件开发者使用
- chore: batch improvements
  - 更新了依赖，修复了一些小问题，提升了项目的整体质量。

</ChangeLog>

<ChangeLog version='0.7.0'>

- chore: gc for modals, fix typo
  - 关闭快速编辑模态框时，自动销毁相关模态框
  - 修正了偏好设置的拼写错误
- feat: prev/next/edit buttons for compare table
  - 快速差异添加了 上一个/下一个/编辑 按钮，方便快速跳转和编辑
- feat: add preferences for in-article links
  - 为文章内链接侵入添加了配置项
  - 例如，你现在可以控制是否为红链添加快速编辑按钮
- fix: wikiLink should skip none article links
  - 重构了 wikiLink 的逻辑
  - 现在 wikiLink 不会再检查非本站链接
- feat: quickEdit support for special:edit/mypage... and so on
  - 快速编辑现在支持一些特殊的特殊页面，例如 Special:Edit/MyPage/MyTalk...
- fix: adjust the button order to match the original mw
  - 调整了快速编辑中的按钮的顺序，使其与原始 MediaWiki 一致
- fix: minor css fixes
  - 修正了一些 CSS 样式
- chore: housekeeping
  - 修复了编辑的快速预览，未附带 pst 参数的问题

</ChangeLog>

<ChangeLog version='0.6.0'>

- feat: add quick delete plugin
  - 我们添加了快速删除插件，现在你可以快速删除页面了！
- refactor: in-article-links
  - 我们重构了wiki链接解析逻辑，现在可以更轻松地获取并解析文章内的wiki链接
- feat: + WikiTitle
  - 添加了 `WikiTitle` 模型，它的用法类似 `mw.Title`，但不依赖 MediaWiki 环境，且更加强大

</ChangeLog>

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
