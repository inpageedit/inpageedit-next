---
title: 快速预览 Quick Preview
---

# 快速预览 Quick Preview

**快速预览** (quick-preview) 用于在弹窗中实时预览 wiki 标记文本的渲染效果，也支持预览图片、视频、音频、PDF 等媒体文件。

## 使用方式

### 在快速编辑中使用

在快速编辑弹窗中，点击「预览」按钮可预览当前编辑内容的渲染效果。快捷键默认为 `Ctrl+I`。

预览弹窗支持拖拽，可以与编辑器并排查看。

### 媒体文件预览

在快速上传等场景中，可以预览上传的文件。支持的媒体类型：

- **图片**：jpg, png, gif, webp, bmp, ico 等
- **视频**：mp4, webm, ogg, avi, mov 等
- **音频**：mp3, wav, ogg, flac, aac 等
- **PDF**：嵌入式 PDF 查看器

## 配置项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `quickPreview.keyshortcut` | `string` | `ctrl-i` | 在快速编辑弹窗中打开预览的快捷键 |

## For Developers

### Public API

```ts
// 通过 ctx.quickPreview 直接调用
ctx.quickPreview(text: string, params?: MwApiParams, wikiPage?: IWikiPage): IPEModal

// 预览 wiki 标记
ctx.quickPreview.previewWikitext(
  text: string,
  params?: MwApiParams,
  wikiPage?: IWikiPage,
  modal?: IPEModal,
  modalOptions?: Partial<IPEModalOptions>
): IPEModal

// 预览媒体文件
ctx.quickPreview.previewFile(fileOrUrl: File | string, alt?: string): Promise<IPEModal | undefined>

// 检测文件类型
ctx.quickPreview.getPreviewType(fileOrUrl: File | string): Promise<string>
// Returns: 'image' | 'video' | 'audio' | 'pdf' | 'html' | 'markdown' | 'text' | 'unknown'

// 获取预览 DOM 元素
ctx.quickPreview.getPreviewElement(fileOrUrl: File | string, alt?: string): Promise<HTMLElement | null>
```

### Events

| Event | Description |
|-------|-------------|
| `quick-preview/show-modal` | Preview modal shown, before content loads. Payload: `{ ctx, modal, wikiPage, text }` |
| `quick-preview/loaded` | Preview content loaded and rendered. Payload: `{ ctx, modal, wikiPage, text, parseData }` |
