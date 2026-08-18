---
title: 使用统计 Analytics
---

# 使用统计 Analytics

**使用统计** (analytics) 是一个可选的使用数据收集插件，帮助开发团队了解 InPageEdit 的使用情况，用于优化功能设计和提升用户体验。

## 使用方式

### 首次使用

首次加载时会弹出通知询问用户是否启用统计，用户可以选择启用或禁用。此选择会持久化保存。

### 数据收集说明

统计功能默认**关闭**，仅在用户明确启用后才开始收集。

**收集的数据：**
- **使用数据**：哪些功能被使用、编辑了哪些页面
- **用户信息**：用户名和用户 ID
- **站点信息**：wiki 的 URL 和站名

**不会收集**敏感数据。

### 数据发送机制

- 事件先缓存在内存队列中
- 每 60 秒批量发送一次
- 队列超过 50 条时立即发送
- 页面隐藏或关闭前会发送剩余数据
- 使用 `navigator.sendBeacon()` 发送，失败时回退到 XMLHttpRequest

### 查看个人数据

在偏好设置的统计选项中，可以跳转到分析平台查看自己的数据。

## 配置项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `analytics.enabled` | `boolean` | `false` | 是否启用使用统计 |

## For Developers

### Public API

```ts
// Queue an analytics event
ctx.analytics.addEvent(feature: string, subtype?: string, page?: string): PluginAnalytics
```

### Events

| Event | Description |
|-------|-------------|
| `analytics/event` | Analytics event broadcasted. Payload: `{ feature, subtype?, page? }` |

The plugin automatically listens to events from other plugins:

| Source Event | Tracked As |
|-------------|------------|
| `in-article-links/anchor-clicked` | `in-article-links` / `quick-edit` or `quick-diff` |
| `quick-diff/loaded` | `quick-diff` / `loaded` |
| `quick-redirect/submit` | `quick-redirect` / `submit` |
| `quick-preview/loaded` | `quick-preview` / `loaded` |
| `quick-edit/wiki-page` | `quick-edit` |
| `quick-edit/submit` | `quick-edit` / `submit` |
| `quick-move/submit` | `quick-move` / `submit` |
| `toolbox/button-clicked` | `toolbox` / `button-clicked#<id>` |
| `plugin-store/plugin-installed` | `plugin-store` / `plugin-installed` |
| `plugin-store/plugin-uninstalled` | `plugin-store` / `plugin-uninstalled` |
