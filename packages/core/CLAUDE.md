# @inpageedit/core

InPageEdit 核心包，基于 Cordis IoC/DI 框架构建的模块化 MediaWiki 插件。

## Entry Points

| Export Path | File | Purpose |
|-------------|------|---------|
| `./` | `src/index.ts` | Web autoloader，自动检测 MediaWiki 环境并初始化 |
| `./core` | `src/core.ts` | 纯库导出（不自动加载） |
| `./InPageEdit` | `src/InPageEdit.ts` | 主类 |
| `./components` | `src/components/index.ts` | UI 组件 |
| `./models` | `src/models/index.ts` | WikiPage / WikiTitle 模型 |
| `./plugins` | `src/plugins/index.ts` | 插件导出 |
| `./services` | `src/services/index.ts` | 服务导出 |
| `./style.css` | — | 打包后的样式 |

## Source Structure

```
src/
├── InPageEdit.ts        # 主类，extends Cordis Context
├── index.ts             # Web autoloader entry
├── core.ts              # Library export
├── services/            # 核心服务 (12 个)
├── plugins/             # 功能插件 (13 个)
├── components/          # UI 组件 (jsx-dom)
├── models/              # WikiPage, WikiTitle 数据模型
├── types/               # 类型定义
├── utils/               # 工具函数（auto-import）
├── constants/           # 端点常量（auto-import）
├── decorators/          # 类装饰器（auto-import）
├── polyfills/           # Polyfills（auto-import）
├── styles/              # SCSS 样式
├── __test__/            # 测试文件
└── __mock__/            # 测试 mock
```

## InPageEdit Main Class

```typescript
class InPageEdit extends Context {
  readonly version: string
  config: InPageEditCoreConfig
  // 初始化流程: constructor → #init() → #initCoreServices() → #initCorePlugins() → #initCoreAssets()
}

interface InPageEditCoreConfig {
  apiConfigs: Partial<FexiosConfigs>
  legacyPreferences: Record<string, any>
  logLevel: number
  storageNamespace: string
  autoloadStyles: boolean
  autoInstallCorePlugins: boolean
}
```

## Services

通过 `ctx.plugin()` 注册，均标记为 builtin（无需显式 `@Inject`）。

| Service | Context Key | Purpose |
|---------|-------------|---------|
| ApiService | `api` | MediaWiki API（wiki-saikou） |
| CurrentPageService | — | 当前页面元数据，支持 bail hooks |
| I18nService | `i18n`, `$`, `$$` | 国际化，模板字面量 + 键值查询 |
| ModalService | `modal` | 弹窗/对话框/通知 |
| PreferencesService | `preferences` | 用户偏好，Schemastery 验证 |
| ResourceLoaderService | — | 动态加载脚本/样式 |
| StorageService | `storage` | IndexedDB + localStorage（idb-plus） |
| ThemeService | — | 主题管理 + SiteThemeAdapter |
| WikiMetadataService | `wiki`, `getUrl` | 站点信息，带 TTL 缓存 |
| WikiPageService | `wikiPage` | WikiPage 模型工厂 |
| WikiTitleService | `wikiTitle` | 标题解析/处理 |
| WikiFileService | `wikiFile` | 文件上传/管理 |

## Plugins

通过 `#initCorePlugins()` 动态导入，均继承 `BasePlugin`。

| Plugin | Purpose |
|--------|---------|
| quick-edit | 页面编辑弹窗 |
| quick-diff | 版本差异对比 |
| quick-move | 页面重命名/移动 |
| quick-preview | 内容预览 |
| quick-redirect | 创建重定向 |
| quick-upload | 文件上传 |
| quick-usage | 模板/文件使用情况 |
| toolbox | 浮动工具栏 |
| plugin-store | 插件市场 |
| preferences-ui | 设置面板（Vue） |
| preferences-ui/PrefSync | 偏好备份/恢复 |
| in-article-links | 文章内快速编辑链接 |
| analytics | 使用统计 |
| _debug | 调试面板（仅开发模式） |

### Plugin Pattern

```typescript
export class PluginExample extends BasePlugin {
  static inject = ['api', 'modal']                      // 依赖声明
  static PreferencesSchema = Schema.object({ ... })      // 偏好 schema

  constructor(ctx: InPageEdit) {
    super(ctx, {}, 'plugin-name')
  }
  protected start() { /* init */ }
  protected stop() { /* cleanup */ }
}
```

### Type Augmentation

插件/服务通过 `declare module` 扩展主类接口：

```typescript
declare module '@/InPageEdit' {
  interface InPageEdit { serviceName: ServiceClass }
  interface Events<C> { 'namespace/event'(data: T): void }
  interface PreferencesMap { 'key.name': Type }
}
```

## Components

jsx-dom 组件（返回真实 DOM，非 React），复杂 UI 使用 Vue 3 + Pug 模板。

| Component | Type | Purpose |
|-----------|------|---------|
| ActionButton | jsx-dom | 按钮 |
| CheckBox / RadioBox | jsx-dom | 选择控件 |
| InputBox | jsx-dom | 输入框 |
| MBox | jsx-dom | 消息框 (info/warning/important) |
| ProgressBar | Vue | 加载进度条 |
| TabView | Vue | 选项卡容器 |
| TwinSwapInput | Vue | 双输入框 |
| MwUserLinks | jsx-dom | 用户链接 |
| Icon/* | jsx-dom | SVG 图标 |

## Event System

基于 [Cordis 事件 API](https://cordis.io/zh-CN/api/core/events.html)（完整框架文档：https://cordis.io/zh-CN/api/ ）。

### 事件注册

```typescript
ctx.on(event, listener, options?)  // 注册监听器，返回清理函数
```

### 事件派发方式

| 方法 | 同步/异步 | 行为 |
|------|-----------|------|
| `ctx.emit()` | 同步 | 同时触发所有匹配的监听器 |
| `ctx.bail()` | 同步 | 依次执行，遇到第一个返回有效值的监听器立即停止并返回 |
| `ctx.parallel()` | 异步 | 并发执行所有匹配的监听器 |
| `ctx.serial()` | 异步 | 依次执行，遇到返回有效值的监听器停止 |
| `ctx.waterfall()` | — | 链式调用，由监听器决定是否传递给下一个 |

### 项目中的用法示例

```typescript
// bail hook: 允许插件拦截/修改值，第一个返回有效值的处理器生效
title = this.ctx.bail('current-page/resolve-title', title) ?? title

// emit: 广播事件
ctx.emit('quick-edit/submit', data)

// on: 监听事件
ctx.on('quick-edit/submit', (data) => { ... })
```

## Build

双格式输出，由 `VITE_BUILD_FORMAT` 环境变量控制：

| Format | Output | Target | Entry |
|--------|--------|--------|-------|
| `import` | `dist/` | ES2022 | 多入口 |
| `bundle` | `lib/` | ES2020 | 单入口 UMD |

- JSX：jsx-dom（`jsxImportSource: "jsx-dom"`）
- Path alias：`@` → `src/`
- Production 会剥离 `console.log`
- 类型声明：Rolldown + `rolldown-plugin-dts`

## Key Dependencies

- `@cordisjs/core` — IoC/DI 框架
- `wiki-saikou` — MediaWiki API 客户端
- `schemastery` — Schema 验证 + 表单生成
- `vue` — 复杂 UI
- `jsx-dom` — 轻量 JSX→DOM
- `@inpageedit/modal` — 弹窗/toast
