# API 参考

::: info WIP

本章节内容仍在编写中，部分 API 可能尚未记录完整，敬请谅解。

:::

本章节将为你介绍所有核心服务和插件的API。

## 全局钩子

如何从全局上下文获得 InPageEdit 实例的引用：

### 1. `mw.hook`

在 MediaWiki 环境中，InPageEdit 会通过 `mw.hook` 提供对其实例的访问：

```ts twoslash
mw.hook('InPageEdit.ready').add((ctx) => {
  //                             ^?
  // `ctx` 是 InPageEdit 实例
})
```

### 2. `window.__IPE_MODULES__`

如果你使用**自动加载器**安装了 InPageEdit，可以通过向 `window.__IPE_MODULES__` 数组中添加回调函数来访问 InPageEdit 实例：

```ts twoslash
;(window.__IPE_MODULES__ ||= []).push((ctx) => {
  //                                   ^?
  // `ctx` 是 InPageEdit 实例
})
```

### 3. `window.ipe` (不推荐)

InPageEdit 会将自己注册为全局变量 `window.ipe`。

不推荐在生产环境或插件中使用此方法，js 的调用时机以及命名冲突问题可能会导致不可预期的错误。此方法仅为了方便调试而保留。

```ts twoslash
const ctx = window.ipe
//    ^?
```

### 4. 将 InPageEdit 作为模块导入

如果你不喜欢**自动加载器**，想要更高的自由度，那你完全可以把 InPageEdit 当作一个普通的模块来导入：

```ts twoslash
import { InPageEdit } from '@inpageedit/core'

const ipe = new InPageEdit({
  // 配置项
})
ipe.start()
//^?
```
