---
title: 使用情况 Quick Usage
---

# 使用情况 Quick Usage

**使用情况** (quick-usage) 是一个元插件，它在快速编辑弹窗中注入页面所使用的模板和文件的链接信息，方便用户快速浏览和操作关联资源。

## 使用方式

此插件不提供独立入口，而是自动集成在快速编辑弹窗中。当编辑器加载页面内容后，编辑区域下方会显示：

- **模板使用情况**：列出当前页面引用的所有模板，点击可快速编辑对应模板
- **文件使用情况**：列出当前页面引用的所有文件/图片
- **快速上传链接**：如果 [快速上传](./quick-upload) 插件可用，会显示上传入口

## 配置项

> 暂无配置项

## For Developers

### Public API

```ts
ctx.quickUsage.getWrapperForQuickEdit(modal: IPEModal): HTMLElement
```

`getWrapperForQuickEdit` returns (or creates) the `.ipe-quickEdit__usages` container element within the quick-edit modal. Other plugins can use this to inject additional usage-related content.

### Events

> 暂无事件

此插件监听 `quick-edit/wiki-page` 事件，在快速编辑弹窗加载完成后注入使用情况信息。
