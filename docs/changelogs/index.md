---
title: 更新日志
---

# InPageEdit NEXT 更新日志

<!-- 
For agents:
- 推送新版本日志时，复制下文提供的模板，并替换版本号、更新内容等信息后，添加到合适的位置（新版通常放在顶部）。
- 只有非常亮眼的新功能或者重大变更才需要添加 <Badge type='rainbow'>重量级</Badge> 标签，其他更新只需列出变更内容即可。
- 有时候多个 commit 是为了了同一个功能或者修复同一个问题，这时候可以合并成一个更新条目，保持日志的简洁和可读性。
- 这个日志可能会很长，超过模型的输入限制，因此建议只读取前 ~250 行，然后使用替换文本功能替换下面的 LATEST_CHANGELOG_HERE 标记为最新版本日志，替换时不要删除标记，以便下次更新时继续使用。
 -->

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

<!-- LATEST_CHANGELOG_HERE -->

<ChangeLog version='0.17.1'>

- feat(schemastery-form): keyshortcut recorder (#41) by @t7ru
  - 新增了快捷键录制功能，允许配置多个快捷键组合
- fix(theme): prevent applyTheme feedback loop on Fandom sites (#42, close #34)
  - 修复了 ThemeService 在 Fandom 站点上因 MutationObserver 反馈循环导致的高 CPU 占用问题

</ChangeLog>

<ChangeLog version='0.17.0'>

- feat(current-page): add bail hooks for title/action/mainPage resolution
  - 新增 `current-page/resolve-title`、`current-page/resolve-action`、`current-page/resolve-main-page` 三个 bail hooks
  - 插件现在可以覆盖 InPageEdit 对当前页面标题、action 和是否为主页的判断，适用于非标准 URL 结构的 wiki
- refactor(theme): replace hardcoded Fandom option with SiteThemeAdapter registry
  - ThemeService 重构为可扩展的适配器注册表模式，告别硬编码
  - 内置 5 个站点主题适配器：MoeSkin、Fandom Desktop/Mobile、Vector 2022、Citizen
  - 新增 `theme.registerSiteThemeAdapter()` API，第三方插件可以注册自定义适配器
  - 适配器基于 DOM class 匹配，比原来的 hostname 模式更可靠
- fix: prefer local file repo on WikiFileService to get correct file urls on wiki farms
  - 修复了在 wiki farm 环境下，文件 URL 可能指向错误仓库的问题
- fix(quick-upload): media query for grid mobile support
  - 快速上传在移动端不再挤成一团了，768px 以下自动切换为单列布局

</ChangeLog>

<ChangeLog version='0.16.1'>

- fix(CurrentPageService): update event handling for history changes and prevent conflicts with SPA frameworks
  - 修复了一个可能导致与 SPA 框架（如 Vue Router）冲突的小问题
- chore(modal): change backdrop event from pointerdown to pointerup for closing behavior
  - 将模态框的背景点击事件从 `pointerdown` 修改为 `pointerup`，以避免移动版 Safari 的点击穿透问题

</ChangeLog>

<ChangeLog version='0.16.0'>

> [!WARNING]
>
> 此版本包含一些未完成的功能，将在后续版本中陆续优化和完善。

- <Badge type='rainbow'>新功能</Badge> refactor(quick-upload): rewritten quick-upload with multiple uploads (#25) by @t7ru
  - 由 Benjamin 带来的新功能，现在你可以通过 quick-upload 插件一次上传多个文件了！
  - ⚠️ 目前移动设备体验不佳，将在后续版本中优化。
- <Badge type='rainbow'>新功能</Badge> feat: ThemeService for dark mode support (#23) by @t7ru
  - 由 Benjamin 带来的新功能，现在你可以通过偏好设置切换黑暗模式了！
  - ⚠️ 目前尚未针对特定 wiki 进行特调，将在后续版本中优化，相关 API 接口可能产生不兼容变化。
- feat(core): exports Icon component (#19) by @Suoerix
  - 导出了一些图标组件，方便开发者使用
  - ⚠️ 目前由于尚未针对 tree-shaking 进行优化，导入图标组件时可能会导致意料外的体积膨胀。
- fix(in-article-links): handle empty content case in onContentReady check
  - 暂时通过防御性编程，避免因 RevisionSlider 扩展在错误时机触发 `wikipage.content` 钩子导致的白屏问题
  - 完整修复将在稍后版本中发布

</ChangeLog>

<ChangeLog version='0.15.0'>

<template #title>0.15.0 <Badge type='rainbow'>重量级</Badge></template>

此版本复刻了 v2 的“使用的模板”、“使用的图片”功能，并添加了全新功能“快速上传文件”。

- feat: + PluginUsage, + PluginUpload, + PluginPreview.previewFile (#16)
  - 新功能：页面使用情况统计、快速上传文件、快速预览文件
- fix(quick-preview): update default key shortcut to avoid conflic (close #7)
  - 将快速预览的默认快捷键从 `Ctrl + P` 修改为 `Ctrl + I`，以避免与浏览器默认快捷键冲突
- fix: should throw error when api returns error with http 200 (close #13) (#14)
- fix(quick-upload): improve warning messages for duplicate files and upload confirmation

</ChangeLog>

<ChangeLog version='0.14.5'>

- fix(in-article-links): checks for quick-edit hook to attach reliably (#12 by @t7ru)
  - 修复了一个时序问题，即使 IPE 加载速度超快（比 mw 的文章渲染速度还快！），也会正确添加页内链™
- fix(styles): update svg icon height to use max function for improved responsiveness
  - 修复了一个导致编辑段落图标不可见的问题

</ChangeLog>

<ChangeLog version='0.14.4'>

- 修复了一些小问题，提升了项目的整体质量。

</ChangeLog>

<ChangeLog version='0.14.3'>

- feat(core): update canonical URL retrieval to include alternate hreflang
  - 修复了位于语言变体页面上的条目无法正确解析 canonical URL 的问题
- fix: enhance quickEdit submission error handling
  - 优化了快速编辑提交时的错误处理逻辑，部分提交错误现在允许选择忽略并重新提交

</ChangeLog>

<ChangeLog version='0.14.2'>

- 修复了一些小问题，提升了项目的整体质量。

</ChangeLog>

<ChangeLog version='0.14.1'>

- 修复了一些小问题，提升了项目的整体质量。

</ChangeLog>

<ChangeLog version='0.14.0'>

<template #title>0.14.0 <Badge type='rainbow'>重量级</Badge></template>

- <Badge type='rainbow'>i18n</Badge> feat(core): introduce I18nService
  - 现已添加多语言支持
  - 部分组件的翻译暂未完善，如有发现，欢迎反馈
- fix(core): improve WikiTitle model and tests
  - `WikiTitle` 不会再重复添加命名空间前缀了

</ChangeLog>

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
