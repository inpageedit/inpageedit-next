---
title: 偏好设置 Preferences UI
---

# 偏好设置 Preferences UI

**偏好设置** (preferences-ui) 提供 InPageEdit 的图形化设置面板，用户可以在此调整所有可配置选项。

## 使用方式

### 通过工具盒使用

点击工具盒中的齿轮图标按钮，打开偏好设置弹窗。

### 设置面板结构

设置面板以标签页形式组织，默认包含以下分类：

| 标签 | 说明 |
|------|------|
| 常规 | 通用设置 |
| 编辑器 | 快速编辑相关配置（摘要、字体、快捷键等） |
| 插件商店 | 插件管理（由 plugin-store 插件注入） |
| 文章内链接 | 文章内链接配置（由 in-article-links 插件注入） |
| 同步 | 偏好设置的备份与恢复 |
| 关于 | 版本信息和项目链接 |

表单根据各插件注册的 Schemastery schema 自动生成，也支持自定义渲染器。

## 配置项

> 暂无配置项

## For Developers

### Public API

```ts
// Show preferences modal
ctx.preferencesUI.showModal(): CustomIPEModal

// Get current modal instance (null if not open)
ctx.preferencesUI.getCurrentModal(): CustomIPEModal | null

// Close current modal
ctx.preferencesUI.closeCurrentModal(): void

// Save current form values to preferences
ctx.preferencesUI.dispatchFormSave(form?): Promise<boolean>

// Get current form values (without saving)
ctx.preferencesUI.getCurrentFormValue(): Record<string, unknown> | undefined

// Merge values into the form (updates UI without saving)
ctx.preferencesUI.mergeFormValue(value: Record<string, unknown>): boolean

// Create a standalone Vue preferences app
ctx.preferencesUI.createPreferencesUIApp(): VueApp
```

### Events

| Event | Description |
|-------|-------------|
| `preferences-ui/modal-shown` | Preferences modal opened. Payload: `{ ctx, modal }` |
| `preferences-ui/vue-app-mounted` | Vue app mounted inside modal. Payload: `{ ctx, app, form }` |
| `preferences-ui/modal-tab-changed` | User switched tab. Payload: `{ ctx, category, $tabContent }` |
| `preferences-ui/form-data-saved` | Form data saved. Payload: `{ ctx, data }` |
| `preferences-ui/modal-closed` | Preferences modal closed. Payload: `{ ctx, modal }` |

---

## 偏好同步 PrefSync

**偏好同步** 是偏好设置的子插件，提供配置的备份与恢复功能。

### 同步方式

| 方式 | 说明 |
|------|------|
| 用户页备份 | 将配置导出到 `User:<用户名>/ipe-prefs.json`，也可从该页面恢复 |
| 文件导入 | 从本地 JSON 文件导入配置 |
| URL 导入 | 从远程 URL 导入配置 |
| 文件导出 | 将配置保存为 JSON 文件下载，或复制到剪贴板 |

### Public API

```ts
// User page operations
ctx.prefSync.importFromUserPage(): Promise<Record<string, unknown>>
ctx.prefSync.exportToUserPage(): Promise<IWikiTitle>
ctx.prefSync.getUserPrefsPageTitle(): IWikiTitle | null

// File/URL import
ctx.prefSync.importFromUrl(url: string): Promise<Record<string, unknown>>
ctx.prefSync.importFromFile(blob: Blob): Promise<Record<string, unknown>>
```

### Events

> 暂无事件
