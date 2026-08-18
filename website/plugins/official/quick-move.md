---
title: 快速移动 Quick Move
---

# 快速移动 Quick Move

**快速移动** (quick-move) 用于在弹窗中快速重命名或移动 wiki 页面，无需跳转到原生的移动页面。

## 使用方式

### 通过工具盒使用

点击工具盒中的移动图标按钮，弹出移动对话框。当前页面名会自动填入「移动自」字段。

### 移动选项

- **移动讨论页**：同时移动关联的讨论页
- **移动子页面**：同时移动最多 100 个子页面
- **不留重定向**：移动后不在原位置留下重定向（需要 `suppressredirect` 权限）
- **移动原因**：可自定义移动原因

## 配置项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `quickMove.reason` | `string` | `[IPE-NEXT] Quick move` | 默认移动原因 |

## For Developers

### Public API

```ts
ctx.quickMove.showModal(options?: Partial<QuickMoveOptions>): Promise<IPEModal>
ctx.quickMove.movePage(options: MovePageOptions): Promise<void>
```

```ts
interface MovePageOptions {
  from: string
  to: string
  reason?: string
  movetalk?: boolean
  movesubpages?: boolean
  noredirect?: boolean
}

interface QuickMoveOptions extends Partial<MovePageOptions> {
  lockFromField?: boolean  // Lock the "from" input
  lockToField?: boolean    // Lock the "to" input
}
```

### Events

| Event | Description |
|-------|-------------|
| `quick-move/init-options` | Options initialized. Payload: `{ ctx, options }` |
| `quick-move/show-modal` | Modal shown. Payload: `{ ctx, modal }` |
| `quick-move/submit` | User submitted move. Payload: `{ ctx, modal, payload: MovePageOptions }` |
