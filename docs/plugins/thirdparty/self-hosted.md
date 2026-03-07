---
title: 自建注册表
---

# 自建插件注册表

除了使用官方注册表之外，你完全可以搭建自己的插件注册表，为你的 wiki 社区提供定制化的插件源。

## 注册表格式

插件注册表本质上是一个遵循 [registry.v1.schema.json](https://registry.ipe.wiki/registry.v1.schema.json) 规范的 JSON 文件。你只需要把这个 JSON 文件托管在任何可以通过 HTTP(S) 访问的地方即可。

一个最小的注册表示例：

```json
{
  "manifest_version": 1,
  "name": "My Wiki Plugins",
  "base_url": "https://your-server.example.com/plugins/",
  "packages": [
    {
      "id": "my-plugin",
      "name": "My Plugin",
      "version": "1.0.0",
      "description": "A custom plugin for our wiki",
      "loader": {
        "kind": "module",
        "entry": "my-plugin/dist/index.mjs"
      }
    }
  ]
}
```

关键字段说明：

| Field | Description |
|-------|-------------|
| `manifest_version` | 固定为 `1` |
| `name` | 注册表的显示名称 |
| `base_url` | 插件资源的基础 URL，`loader.entry` 等路径会相对于此 URL 解析 |
| `packages` | 插件列表数组 |

每个 package 的 `loader.entry` 路径会与 `base_url` 拼接，得到最终的插件加载地址。

## 使用自建注册表

在 InPageEdit 的插件商店设置中，添加你的注册表 JSON 地址即可。用户可以同时使用多个注册表。

## :warning: 安全警告

::: danger 请务必阅读
InPageEdit 的第三方插件是 **在 wiki 页面环境中直接执行的 JavaScript 脚本**，它们没有任何沙箱隔离或权限限制。

这意味着一个插件可以：

- 读写当前页面的任何内容
- 以当前登录用户的身份调用 MediaWiki API（编辑页面、删除页面、封禁用户......）
- 访问 cookie、localStorage 等浏览器存储
- 向任意外部服务器发送数据

**在向你的 InPageEdit 添加第三方注册表时，请确保你信任该注册表的维护者。** 安装来路不明的插件，就像运行来路不明的用户脚本一样——后果可能很严重。

官方注册表中的插件经过维护团队审核，但自建注册表的安全性完全取决于你自己。
:::

## 建议的安全实践

- **代码审查**：在上架插件前，仔细审查插件的源代码
- **限制访问**：如果注册表仅供特定社区使用，考虑通过网络层限制访问
- **版本锁定**：关注插件更新，避免自动加载未经审查的新版本
- **使用 HTTPS**：确保注册表通过 HTTPS 提供服务，防止中间人篡改
