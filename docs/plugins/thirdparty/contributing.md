---
title: 贡献插件
---

# 贡献你的插件

写了一个超酷的 InPageEdit 插件？别藏着掖着，来官方注册表上架吧！让全世界的 wiki 编辑者都能享受你的创作。

## 官方插件注册表仓库

:point_right: [**inpageedit/plugin-registry**](https://github.com/inpageedit/plugin-registry)

这是 InPageEdit 官方维护的插件注册表仓库。所有在[插件商店](/plugins/official/plugin-store)中默认可见的第三方插件，都来自这里。

## 上架流程

整个过程比你想象的要简单——我们甚至准备了脚手架帮你生成模板：

### 1. Clone 仓库

```bash
git clone https://github.com/inpageedit/plugin-registry.git
cd plugin-registry
pnpm install
```

### 2. 创建新插件

```bash
pnpm run new
```

跟着提示输入插件名称、描述等信息，脚手架会在 `packages/` 下生成一个完整的插件模板，包含：

- `src/index.ts` — 插件入口
- `vite.config.ts` — 构建配置
- `package.json` — 元数据和 `$ipe` 配置

### 3. 编写插件代码

在 `packages/你的插件名/src/` 下尽情发挥。如果你对插件开发还不太熟悉，可以参考[插件开发指南](/development/plugins-101/)。

### 4. 本地调试

```bash
pnpm dev
```

开发服务器会在 `http://localhost:1029/` 启动。你可以把 `http://localhost:1029/registry.v1.json` 添加到 InPageEdit 的插件商店设置中，实时预览你的插件效果。修改代码后刷新即可生效，无需重启。

### 5. 提交 PR

确认一切正常后，向仓库提交 Pull Request。维护团队审核通过后，你的插件就会出现在官方注册表中。

::: tip 小贴士
- 项目内置了 VS Code 的 JSON Schema 支持，编辑 `package.json` 时 `$ipe` 字段会有智能提示
- `$ipe.dev_loader` 可以单独指定开发环境的入口文件，避免路径猜测问题
- 详细的配置说明和字段文档请参考[仓库 README](https://github.com/inpageedit/plugin-registry#readme)
:::

## 插件配置参考

每个插件的 `package.json` 中需要包含 `$ipe` 字段：

```json
{
  "name": "inpageedit-plugin-awesome",
  "version": "1.0.0",
  "description": "An awesome plugin",
  "author": "your-name",
  "license": "MIT",
  "$ipe": {
    "name": "My Awesome Plugin",
    "description": "Does awesome things",
    "categories": ["editor"],
    "loader": {
      "kind": "module",
      "entry": "dist/index.mjs",
      "styles": ["dist/style.css"],
      "main_export": "default"
    }
  }
}
```

加载方式 (`loader.kind`) 支持以下几种：

| Kind | Description |
|------|-------------|
| `module` | ES module, exported as plugin object |
| `umd` | UMD bundle, auto-registers on load |
| `autoload` | Script that runs immediately on load |
| `styles` | CSS-only package, no JavaScript |

完整的 Schema 定义: [ipe-package.schema.v1.json](https://registry.ipe.wiki/ipe-package.schema.v1.json)
