---
title: 文章内链接 In-Article Links
---

# 文章内链接 In-Article Links

**文章内链接** (in-article-links) 会自动扫描页面正文中的 wiki 链接，并在编辑类链接旁注入快速编辑/快速差异的图标按钮，让用户无需跳转即可操作。

## 使用方式

启用后，插件会在以下链接旁自动添加操作按钮：

- **编辑链接**（`action=edit`）旁添加快速编辑图标
- **差异链接**（`diff=xxx`）旁添加快速差异图标
- **红色链接**（未创建的页面）旁也可添加快速编辑图标（可配置）
- 支持 `Special:Edit` 和 `Special:NewSection` 等特殊页面链接

当页面通过 AJAX 动态加载新内容时（如展开折叠区域），插件也会自动处理新出现的链接。

### 不兼容的链接

以下链接不会注入按钮：
- 包含 `preload` 参数的链接
- 包含 `redo` 参数的链接

## 配置项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `inArticleLinks.enable` | `boolean` | `true` | 是否启用文章内链接 |
| `inArticleLinks.quickEdit.enable` | `boolean` | `true` | 是否注入快速编辑按钮 |
| `inArticleLinks.quickDiff.enable` | `boolean` | `true` | 是否注入快速差异按钮 |
| `inArticleLinks.quickEdit.redlinks` | `boolean` | `true` | 是否在红色链接旁显示快速编辑按钮 |

## For Developers

### Public API

```ts
// Parse a single anchor element, returns metadata or null
ctx.inArticleLinks.parseAnchor(anchor: HTMLAnchorElement): InArticleWikiAnchorMetadata | null

// Scan all anchors within a parent element, with optional filter
ctx.inArticleLinks.scanAnchors(
  parent: HTMLElement,
  filter?: (info: InArticleWikiAnchorMetadata) => boolean
): InArticleWikiAnchorMetadata[]
```

`InArticleWikiAnchorMetadata`:

```ts
interface InArticleWikiAnchorMetadata extends WikiLinkMetadata {
  $el: HTMLAnchorElement
  kind: 'normal' | 'mw:File'
  external: boolean
  redlink: boolean
}
```

Parsed results are cached per anchor element via `WeakMap`.

### Events

| Event | Description |
|-------|-------------|
| `in-article-links/anchor-parsed` | Anchor parsed for the first time. Payload: `{ ctx, anchor, info }` |
| `in-article-links/anchor-clicked` | Quick edit/diff button clicked. Payload: `{ ctx, anchor, info, event, action: 'quickEdit' \| 'quickDiff' }` |
