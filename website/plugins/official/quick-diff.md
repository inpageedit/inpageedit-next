---
title: 快速差异 Quick Diff
---

# 快速差异 Quick Diff

**快速差异** (quick-diff) 用于在弹窗中对比两个页面版本之间的差异，无需跳转到原生差异对比页面。

## 使用方式

### 在快速编辑中使用

在快速编辑弹窗中，点击「差异」按钮可对比当前编辑内容与原始内容之间的差异。快捷键默认为 `Ctrl+D`。

### 在页面历史中使用

在页面的修订历史页面，原生「比较已选版本」按钮旁会自动添加一个「快速差异」按钮，点击即可在弹窗中查看差异。

### 差异查看器功能

- 以表格形式展示差异，复用 MediaWiki 原生差异样式
- 显示版本作者、时间戳、编辑摘要等元信息
- 支持通过前/后版本按钮导航历史
- 可从差异查看器直接跳转到快速编辑
- 可跳转到原始差异对比页面

## 配置项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `quickDiff.keyshortcut` | `string` | `ctrl-d` | 在快速编辑弹窗中打开差异的快捷键 |

## For Developers

### Public API

```ts
ctx.quickDiff.comparePages(
  options: Partial<CompareApiRequestOptions>,
  modal?: IPEModal,
  modalOptions?: Partial<IPEModalOptions>
): IPEModal

ctx.quickDiff.createQuickDiffButton(
  payload: Partial<CompareApiRequestOptions>,
  options?: { label?: ReactNode; icon?: ReactNode }
): HTMLAnchorElement
```

`CompareApiRequestOptions` supports MediaWiki compare API params:

```ts
interface CompareApiRequestOptions {
  fromtitle: string; fromid: number; fromrev: number; fromtext: string
  totitle: string;   toid: number;   torev: number;   totext: string
  torelative?: 'cur' | 'prev' | 'next'
  frompst: boolean;  topst: boolean
  difftype: 'table' | 'unified'
  // ...more MediaWiki compare API params
}
```

### Events

| Event | Description |
|-------|-------------|
| `quick-diff/init-options` | Options initialized. Payload: `{ ctx, options }` |
| `quick-diff/loaded` | Diff data loaded and rendered. Payload: `{ ctx, modal, compare }` |
| `quick-diff/quick-edit-modal` | Diff opened from within quick-edit modal. Payload: `{ ctx, modal, wikiPage }` |
