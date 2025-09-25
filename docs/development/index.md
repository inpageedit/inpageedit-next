# 开发者指南

本指南将帮助您了解如何为 InPageEdit NEXT 开发插件和扩展功能。

> [!TIP]
>
> 本指南假设您已经熟悉 JavaScript/TypeScript、DOM API、Node.js 等前端开发基础知识，并且对于 MediaWiki 的 API 有一定的了解。

## 重新认识 InPageEdit NEXT

InPageEdit NEXT 最熟为人知的功能是“快速编辑”。

但你也许想不到的是，IPE本身是一个巨大的元框架，它的核心仅仅是一个提供基于依赖注入、事件总线、状态管理、异步任务调度等基础功能的框架。

即便是核心功能“快速编辑”，也仅仅是一个基于事件总线的插件，它并不关心wiki配置，也不关心页面内容，它只是基于 sitemeta + wikiPage 服务提供的数据，显示了一个编辑框，而预览、保存编辑内容也并非由它负责。

听上去很难理解？没关系，我们将会从开发一个简单的插件开始，逐步带你了解 IPE 的开发流程。

## 准备开发环境

我们采用 pnpm 作为包管理器。

- Node.js: >= 22.x
- pnpm: >= 10.x

1. **克隆项目仓库**

```bash
git clone https://github.com/inpageedit/inpageedit-next.git
cd inpageedit-next
```

2. **安装依赖**

```bash
pnpm install
```

3. **启动开发服务器**

```bash
pnpm dev
```

### 项目结构

```
src/
├── components/         # 通用组件
├── plugins/            # 内置插件
├── services/           # 核心服务
├── types/              # TypeScript 类型定义
├── utils/              # 工具函数
├── InPageEdit.ts       # 主类
└── index.ts            # 入口文件
```

## 🔗 相关资源

- [TypeScript 官方文档](https://www.typescriptlang.org/)
- [JSX-DOM](https://npmjs.com/package/jsx-dom)
- [MediaWiki API 文档](https://www.mediawiki.org/wiki/API:Main_page)
- [GitHub 仓库](https://github.com/inpageedit/inpageedit-next)
- [问题反馈](https://github.com/inpageedit/inpageedit-next/issues)
