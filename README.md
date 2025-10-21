<div align="center">

[<img src="/docs/.vitepress/public/images/logo/ipe-next-uwu.png" width="280" alt="InPageEdit Logo">](https://www.ipe.wiki)

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
    src: 'https://unpkg.com/@inpageedit/core',
    type: 'module',
  })
)
```

## For developers

This is a monorepo:

| package            | description                                                                      | directory                                              |
| ------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------ |
| @inpageedit/core   | 🚀 Modular, Extensible Supercharged Plugin for MediaWiki                         | [packages/core](packages/core)                         |
| @inpageedit/logger | Flexible, Extensible Console Logger with Colored Labels and Hierarchical Loggers | [packages/logger](packages/logger)                     |
| schemastery-form   | 🧩 WebComponent for Schemastery Form Generation                                  | [packages/schemastery-form](packages/schemastery-form) |
| docs               | InPageEdit Documentation                                                         | [docs](docs)                                           |
| plugins            | Official Plugins                                                                 | [plugins](plugins)                                     |

---

🚀 Modular, Extensible Supercharged Plugin for MediaWiki.

> [MIT License](https://opensource.org/licenses/MIT)
>
> InPageEdit-NEXT Copyright © 2025-present dragon-fish

See more: [GitHub](https://github.com/inpageedit/inpageedit-next) | [Change Logs](https://www.ipe.wiki/changelogs/) | [File Issues](https://github.com/inpageedit/inpageedit-next/issues)
