## 为站点安装小工具（Gadget）

如果你是 wiki 的管理员，你可以通过小工具（Gadget）安装 InPageEdit NEXT。

在 wiki 中创建以下页面：

::: code-group

```wiki [MediaWiki:Gadgets-definition]
* IPE-NEXT[ResourceLoader|rights=edit,skipcaptcha]|IPE-NEXT.js
```

```js [MediaWiki:Gadget-IPE-NEXT.js]
document.body.append(
  Object.assign(document.createElement('script'), {
    src: 'https://cdn.jsdelivr.net/npm/@inpageedit/core/dist/index.js',
    type: 'module',
  })
)
```

```wiki [MediaWiki:Gadget-IPE-NEXT]
[InPageEdit-NEXT https://www.ipe.wiki] - 🚀 模块化、可扩展的 MediaWiki 超级增强插件(小编辑、重定向、页面历史)
```

:::

大功告成，前往参数设置页面 → 小工具，查看小工具是否成功注册。

> [!IMPORTANT]
>
> 部分站点（例如 Fandom、Miraheze）出于安全考虑，对于外部资源引入有一些限制。
>
> <details>
>
> <summary>替代方案，供参考：</summary>
>
> 1. 下载 IPE 的[捆绑包](https://www.jsdelivr.com/package/npm/@inpageedit/core?tab=files&path=lib)版本，并将 css/js 文件分别创建为 `MediaWiki:Gadget-IPE-NEXT.css` 和 `MediaWiki:Gadget-IPE-NEXT.js`
> 2. `MediaWiki:Gadgets-definition` 中相关的行修改为 `* IPE-NEXT[ResourceLoader|rights=edit,skipcaptcha]|IPE-NEXT.js|IPE-NEXT.css`
>
> </details>
