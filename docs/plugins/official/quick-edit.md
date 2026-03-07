---
title: 快速编辑 Quick Edit
---

# 快速编辑 Quick Edit

**快速编辑** (quick-edit) 是 InPageEdit 最核心的功能，能让您在不打开新标签页的情况下编辑 wiki 页面。支持整页编辑、段落编辑、新建段落、新建页面，以及基于历史版本编辑。

## 使用方式

### 通过工具盒使用

点击工具盒中的铅笔图标按钮，即可快速编辑当前页面。如果当前页面 URL 包含 `oldid` 参数，将基于该历史版本编辑。

### 通过段落编辑链接

在启用了 [文章内链接](./in-article-links) 插件的情况下，段落标题旁会出现「快速编辑」链接，点击可仅编辑该段落。

### 编辑器功能

- **编辑摘要**：自动填入默认摘要，可自定义
- **小编辑标记**：可选标记为小编辑
- **监视列表**：支持 4 种监视选项（跟随偏好设置 / 保持不变 / 添加监视 / 移除监视）
- **未保存提醒**：内容修改后关闭弹窗会弹出确认对话框，关闭标签页时也会提醒
- **编辑冲突处理**：遇到编辑冲突、页面被删等情况时，允许再次提交以覆盖
- **键盘快捷键**：默认 `Ctrl+S` 保存（可配置）

## 配置项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `quickEdit.editSummary` | `string` | `[IPE-NEXT] Quick edit` | 默认编辑摘要 |
| `quickEdit.editMinor` | `boolean` | `false` | 默认勾选"小编辑" |
| `quickEdit.outSideClose` | `boolean` | `true` | 点击弹窗外部区域关闭编辑器 |
| `quickEdit.watchList` | `WatchlistAction` | `preferences` | 监视列表行为 |
| `quickEdit.keyshortcut.save` | `string` | `ctrl-s` | 保存快捷键（留空禁用） |
| `quickEdit.editFont` | `string` | `preferences` | 编辑器字体，可选 `preferences` / `monospace` / `sans-serif` / `serif` 或自定义 CSS `font-family` |

## For Developers

### Public API

```ts
// 通过 ctx.quickEdit 直接调用
ctx.quickEdit(title?: string)
ctx.quickEdit(options?: Partial<QuickEditOptions>)

// 方法
ctx.quickEdit.showModal(payload?: string | Partial<QuickEditOptions>): Promise<void>
ctx.quickEdit.handleSubmit(payload: QuickEditSubmitPayload): Promise<void>
ctx.quickEdit.createQuickEditButton(payload: Partial<QuickEditOptions>, options?: { icon?: ReactNode; label?: ReactNode }): HTMLAnchorElement
ctx.quickEdit.getEditFontOptions(): Promise<{ className: string; fontFamily: string }>
ctx.quickEdit.getWikiPageFromPayload(payload: Partial<QuickEditOptions>): Promise<IWikiPage>
```

`QuickEditOptions`:

```ts
interface QuickEditOptions {
  title: string
  pageId: number
  revision: number
  section: number | 'new' | undefined  // undefined = 整页, 0 = 第一段, 'new' = 新段落
  editMinor: boolean
  editSummary: string
  createOnly: boolean
  reloadAfterSave: boolean
}
```

### Events

| Event | Description |
|-------|-------------|
| `quick-edit/init-options` | Options initialized, before modal opens. Payload: `{ ctx, options }` |
| `quick-edit/show-modal` | Modal shown, before loading page content. Payload: `{ ctx, modal, options }` |
| `quick-edit/wiki-page` | Page content loaded. Payload: `{ ctx, modal, options, wikiPage }` |
| `quick-edit/edit-notice` | Before rendering edit notices. Payload includes `editNotices: ReactNode[]`, push to add custom notices |
| `quick-edit/submit` | User submitted edit. Payload: `{ ctx, wikiPage, text, summary, section, minor, ... }` |
