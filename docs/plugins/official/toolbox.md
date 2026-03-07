---
title: 工具盒 Toolbox
---

# 工具盒 Toolbox

**工具盒** (toolbox) 是 InPageEdit 的浮动工具栏，为其他插件提供统一的入口按钮。它悬浮在页面右下角，鼠标悬停时展开显示所有功能按钮。

## 使用方式

### 基本交互

- **悬停展开**：鼠标移入工具盒区域时自动展开，移出后 150ms 自动收起
- **固定展开**：点击 `+` 按钮可切换为常驻展开状态
- **按钮分组**：
  - **group1**（垂直排列）：核心功能按钮，如快速编辑、快速移动、快速重定向
  - **group2**（水平排列）：辅助功能按钮，如快速上传、设置

按钮带有提示文字 (tooltip)，展开动画有渐进延迟效果。

## 配置项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `toolboxAlwaysShow` | `boolean` | `false` | 默认常驻展开工具盒 |

## For Developers

Toolbox extends Cordis `Service` (not `BasePlugin`), registered as `ctx.toolbox`.

### Public API

```ts
// Add or replace a button
ctx.toolbox.addButton(payload: ToolboxButton): void

// Remove a button by id
ctx.toolbox.removeButton(id: string): void

// Get the toolbox DOM container
ctx.toolbox.getContainer(): HTMLElement

// Toggle persistent (always-open) state
ctx.toolbox.toggle(force?: boolean): void

// Check if toolbox is currently opened
ctx.toolbox.isOpened: boolean
```

`ToolboxButton`:

```ts
interface ToolboxButton {
  id: string
  group?: 'auto' | 'group1' | 'group2'  // 'auto' balances between groups
  icon: string | HTMLElement | SVGElement | ReactElement  // or () => ...
  tooltip?: string | HTMLElement | (() => ...)
  itemProps?: JSX.IntrinsicElements['li']
  buttonProps?: JSX.IntrinsicElements['button']
  onClick?: (event: MouseEvent) => void
  index?: number  // Sorting: negative = early, positive = late, Infinity = end
}
```

### Events

| Event | Description |
|-------|-------------|
| `toolbox/button-added` | Button added or replaced. Payload: `{ ctx, payload: ToolboxButton }` |
| `toolbox/button-removed` | Button removed. Payload: `{ ctx, payload: ToolboxButton }` |
| `toolbox/button-clicked` | Button clicked. Payload: `{ ctx, event: MouseEvent, payload: ToolboxButton }` |
| `toolbox/toggle` | Persistent state toggled. Payload: `{ ctx, opened: boolean }` |
