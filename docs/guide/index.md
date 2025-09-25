---
title: 用户指南
---

# InPageEdit NEXT 用户指南

欢迎使用 InPageEdit NEXT！这是一个专为 MediaWiki 设计的模块化、可扩展超级增强插件。

## 快速安装

### 方法一：个人 JS 页面安装（推荐）

1. 登录您的 MediaWiki 账户
2. 访问您的**个人 JS 页面**（通常是 `User:您的用户名/common.js`）
3. 添加以下代码：

```javascript
// InPageEdit NEXT
$('<script src="https://esm.run/@inpageedit/core" type="module"></script>').appendTo('body')
```

4. 保存页面，刷新任意页面即可开始使用

### 方法二：通过 CDN 安装

```html
<script src="https://esm.run/@inpageedit/core" type="module"></script>
```

## 主要功能

### 🚀 快速编辑
- **快速编辑**：点击页面上的编辑按钮即可快速编辑当前页面
- **快速移动**：快速重命名或移动页面
- **快速重定向**：创建页面重定向
- **快速差异**：查看页面修改历史差异

### 📋 工具箱功能
- 在页面右上角工具栏中添加了多个实用工具
- 支持自定义工具栏按钮
- 提供快捷操作入口

### 🔍 页面预览
- 实时预览页面修改效果
- 支持语法高亮和格式化
- 快速切换编辑和预览模式

## 基本使用

### 编辑页面
1. 在任意页面上，您会看到工具栏中的编辑按钮
2. 点击编辑按钮打开快速编辑界面
3. 修改内容后点击保存即可

### 移动页面
1. 点击工具箱中的移动按钮
2. 输入新的页面名称
3. 确认移动操作

### 查看差异
1. 点击差异按钮
2. 选择要比较的版本
3. 查看详细的修改内容

## 配置选项

InPageEdit NEXT 提供了丰富的配置选项，您可以通过以下方式自定义：

### 用户偏好设置
```javascript
// 在个人 JS 页面中添加配置
window.InPageEdit = window.InPageEdit || {}
window.InPageEdit.myPreferences = {
  // 您的配置选项
}
```

### 常用配置项
- `quickEdit.enabled`: 启用/禁用快速编辑功能
- `toolbox.position`: 设置工具箱位置
- `theme.darkMode`: 启用深色主题

## 故障排除

### 常见问题

**Q: 安装后没有看到工具栏？**
A: 请确保您有编辑权限，并检查浏览器控制台是否有错误信息。

**Q: 快速编辑功能不工作？**
A: 可能是权限问题，请确认您有编辑当前页面的权限。

**Q: 如何卸载插件？**
A: 从个人 JS 页面中删除安装代码即可。

### 获取帮助
- 查看 [GitHub Issues](https://github.com/inpageedit/inpageedit-next/issues)
- 访问 [官方文档](https://ipe.js.org/)
- 加入社区讨论

## 更新日志

定期检查更新以获取最新功能和安全修复：

```javascript
// 检查更新（在控制台中运行）
console.log('InPageEdit NEXT Version:', window.ipe?.version)
```
