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
>
> <details>
>
> <summary>部分维基站点的启用/安装方法：</summary>
>
> 1. [萌娘百科](https://zh.moegirl.org.cn) ：该站点已经通过小工具（Gadget）预装了本插件。登录站点后，在站点的 [参数设置](https://zh.moegirl.org.cn/Special:%E5%8F%82%E6%95%B0%E8%AE%BE%E7%BD%AE#mw-prefsection-gadgets)-编辑工具 中可直接勾选并启用。
> 2. [灰机Wiki](https://www.huijiwiki.com/) ：该站大部分站点出于对安全的考虑，禁用了个人JS功能。要在该站点下的分站启用插件，需要在灰机workshop的[Manifest:InPageEdit](https://templatemanager.huijiwiki.com/p/799)页面手动安装零件到分站（需要开发者权限）。安装后在分站中点击头像-偏好设置-小零件勾选并为自己启用。
>
> </details>
