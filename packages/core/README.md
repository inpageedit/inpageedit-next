<div align="center">

[<img src="https://www.ipe.wiki/images/logo/ipe-next-uwu.png" width="280" alt="InPageEdit Logo">](https://www.ipe.wiki)

# InPageEdit NEXT

🚀 MediaWiki 的模块化、可扩展超级增强插件

**InPageEdit NEXT**是由机智的小鱼君开发的一款 MediaWiki 多功能插件。主要功能旨在使许多 MediaWiki 的功能在不打开新标签页的情况下完成(包括但不限于编辑)，极大加快维护 wiki 的速度。模块化设计、类型定义清晰完整，插件可自由热插拔。

→ <https://www.ipe.wiki> ←

</div>

## 快速上手 / Quick Start

[![](https://data.jsdelivr.com/v1/package/npm/@inpageedit/core/badge)](https://www.jsdelivr.com/package/npm/@inpageedit/core)

在*个人 JS 页*添加以下代码：

<!-- prettier-ignore -->
```javascript
// InPageEdit NEXT
document.body.append(
  Object.assign(document.createElement('script'), {
    src: 'https://cdn.jsdelivr.net/npm/@inpageedit/core/dist/index.js',
    type: 'module',
  })
)
```

## 特色功能 / Features

**编辑者视角 / For wiki editors**

- 快速编辑 / Quick Edit
- 快速移动 / Quick Move
- 快速重定向 / Quick Redirect
- 快速差异 / Quick Diff
- 快速预览 / Quick Preview

**开发者视角 / For developers**

- 可热插拔的模块化设计
- 完全使用 TypeScript 编写
- 超简单的扩展能力，示例插件：[hello-world](./docs/.templates/examples/plugins/hello-world.js)

## Supported languages

- **English (en)**
- العربية (ar)
- Français (fr)
- Hindī (hi)
- 日本語 (ja)
- Nederlands (nl)
- Polski (pl)
- Português do Brasil (pt_BR)
- **中文(简体) (zh-Hans)**
- 中文(繁體) (zh-Hant)

[Help us translate](https://crowdin.com/project/inpageedit)

---

🚀 Modular, Extensible Supercharged Plugin for MediaWiki.

> [MIT License](https://opensource.org/licenses/MIT)
>
> InPageEdit-NEXT Copyright © 2025-present dragon-fish

See more: [GitHub](https://github.com/inpageedit/inpageedit-next) | [Change Logs](https://www.ipe.wiki/changelogs/) | [File Issues](https://github.com/inpageedit/inpageedit-next/issues) | [Plugin Registry](https://github.com/inpageedit/plugin-registry) | [Translate (Crowdin)](https://crowdin.com/project/inpageedit)
