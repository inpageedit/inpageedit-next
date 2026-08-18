---
title: 快速重定向 Quick Redirect
---

# 快速重定向 Quick Redirect

**快速重定向** (quick-redirect) 用于在弹窗中快速创建 wiki 重定向页面。

## 使用方式

### 通过工具盒使用

点击工具盒中的重定向图标按钮，弹出重定向对话框。当前页面名会自动填入「重定向至」字段。

### 重定向选项

- **重定向来源 / 重定向至**：可交换的双输入框
- **重定向原因**：可自定义原因
- **强制覆盖**：如果来源页面已存在，勾选后将覆盖其内容为重定向

## 配置项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `quickRedirect.reason` | `string` | `[IPE-NEXT] Quick redirect` | 默认重定向原因 |

## For Developers

### Public API

```ts
ctx.quickRedirect.showModal(options?: Partial<QuickRedirectOptions>): Promise<IPEModal>
ctx.quickRedirect.redirectPage(options: RedirectPageOptions): Promise<void>
```

```ts
interface RedirectPageOptions {
  from: string       // Source page title
  to: string         // Target page title
  reason?: string
  overwrite?: boolean // Force overwrite if source exists
}
```

### Events

| Event | Description |
|-------|-------------|
| `quick-redirect/init-options` | Options initialized. Payload: `{ ctx, options }` |
| `quick-redirect/show-modal` | Modal shown. Payload: `{ ctx, modal }` |
| `quick-redirect/submit` | User submitted redirect. Payload: `{ ctx, payload: RedirectPageOptions }` |
