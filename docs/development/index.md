# 开发者指南

本指南将帮助您了解如何为 InPageEdit NEXT 开发插件和扩展功能。

## 🚀 快速开始

### 环境准备

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

## 🔌 插件开发基础

### 插件注册方式

InPageEdit NEXT 支持三种插件注册方式：

#### 1. 函数式插件

```javascript
ipe.plugin((ctx) => {
  // 插件逻辑
})
```

#### 2. 对象式插件

```javascript
ipe.plugin({
  name: 'my-plugin',
  inject: ['toolbox', 'modal'],
  apply(ctx) {
    // 插件逻辑
  },
})
```

#### 3. 类式插件

```ts
class MyPlugin {
  static inject = ['toolbox', 'modal']

  constructor(public ctx: InPageEdit) {
    // 插件逻辑
  }
}
ipe.plugin(MyPlugin)
```

### 依赖注入系统

插件可以通过 `inject` 属性声明需要的服务：

```javascript
ipe.plugin({
  name: 'my-plugin',
  inject: ['toolbox', 'modal', 'quickEdit'],
  apply(ctx) {
    // 现在可以使用 ctx.toolbox, ctx.modal, ctx.quickEdit
  },
})
```

## 🔗 相关资源

- [TypeScript 官方文档](https://www.typescriptlang.org/)
- [Vue 3 官方文档](https://vuejs.org/)
- [MediaWiki API 文档](https://www.mediawiki.org/wiki/API:Main_page)
- [GitHub 仓库](https://github.com/inpageedit/inpageedit-next)
- [问题反馈](https://github.com/inpageedit/inpageedit-next/issues)
