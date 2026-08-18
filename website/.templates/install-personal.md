## 个人安装方式

### 使用动态导入 （推荐）

在个人 JS 页面添加以下代码：

```js [Special:MyPage/common.js]
// InPageEdit NEXT
document.body.append(
  Object.assign(document.createElement('script'), {
    src: 'https://cdn.jsdelivr.net/npm/@inpageedit/core/dist/index.js',
    type: 'module',
  })
)
```

::: details 其他安装方式

### jQuery

你当然可以使用jQuery简化语法，大多数 MediaWiki 环境都自带 jQuery。

```js [Special:MyPage/common.js]
// InPageEdit NEXT
$(
  '<script src="https://cdn.jsdelivr.net/npm/@inpageedit/core/dist/index.js" type="module"></script>'
).appendTo('body')
```

### 浏览器插件

如果你更喜欢使用浏览器插件（例如油猴），可以使用以下代码（仅供参考，不保证有效）：

```js
// ==UserScript==
// @name         InPageEdit NEXT
// @namespace    https://www.ipe.wiki
// @version      0.1.0
// @description  🚀 模块化、可扩展的 MediaWiki 超级增强插件
// @author       dragon-fish
// @match        *
// @grant        none
// ==/UserScript==

window.RLQ = window.RLQ || []
window.RLQ.push(() => {
  gm.addElement('script', {
    src: 'https://cdn.jsdelivr.net/npm/@inpageedit/core/dist/index.js',
    type: 'module',
  })
})
```

### 下载捆绑包

我们同时提供了 bundled 版本，以便那些有特殊需求的用户使用：[下载地址](https://www.jsdelivr.com/package/npm/@inpageedit/core?tab=files&path=lib)

捆绑包采用传统 UMD 格式打包，没有动态导入，因此加载速度可能略慢。另外，此版本不会尝试自动导入 CSS，因此你需要手动加载 CSS 文件。

:::

::: details 注意事项

### 不要使用 `mw.loader.load` 加载

InPageEdit-NEXT 是 ES 模块脚本，直接使用 `mw.loader` 加载会报错。

如果你更喜欢 `mw.loader`，请加载捆绑包版本（同时你会失去动态导入带来的性能优化）。

### 不要在 MediaWiki 的 JS 页面使用 `import`

你也许有想过这个问题：为什么不直接使用 `import(/** ... */)` 加载 InPageEdit-NEXT？

这是因为 MediaWiki 的 ResourceLoader 会将 import 语句自动转换为一些内部实现，导致实际行为预期不符。

:::
