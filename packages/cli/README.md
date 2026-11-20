<div align="center">

[<img src="https://www.ipe.wiki/images/logo/ipe-next-uwu.png" width="280" alt="InPageEdit Logo">](https://www.ipe.wiki)

# InPageEdit CLI

🤖 让你的 AI Agent 安全地读写 MediaWiki

[![npm](https://img.shields.io/npm/v/@inpageedit/cli)](https://www.npmjs.com/package/@inpageedit/cli)

</div>

## 交给你的 Agent / Hand it to your agent

把下面这句话发给 Claude Code、Codex 等任意 coding agent，它会完成安装，并带你登录 Wiki 账号：

```text
阅读并为我安装 https://github.com/inpageedit/inpageedit-next/blob/master/packages/cli/INSTALL.md
```

```text
Read and install this for me: https://github.com/inpageedit/inpageedit-next/blob/master/packages/cli/INSTALL.md
```

## 特性 / Features

- **密码不经过 Agent**：登录时在你自己的浏览器里填写 Bot Password，Agent 只拿到一个登录链接。凭据保存在系统钥匙串（macOS Keychain / Windows 凭据管理器 / Linux Secret Service）。
- **改得稳**：拉取 → 本地编辑 → diff → 预览 → 保存，保存时校验基准版本，别人中途改过页面会报编辑冲突而不是覆盖。
- **只动一个章节**：长页面可以按章节读写，其他部分原样保留。
- **预览先行**：保存前即可看到解析警告、分类、缺失模板和红链。
- **覆盖整个 Action API**：移动页面、上传文件，以及任意 API 模块的直接调用。
- **多账号**：每个 Wiki、每个身份一份 profile，随时切换。
- **内置 Agent 指南**：`ipe skill` 输出与当前版本匹配的使用指南，可直接存为 Agent 的 skill。

## 手动安装 / Manual install

需要 Node.js 22.14+。

```sh
npm i -g @inpageedit/cli
ipe login --profile my-wiki --api https://wiki.example.org/api.php --web
ipe --help
```

---

> [MIT License](https://opensource.org/licenses/MIT)
>
> InPageEdit-NEXT Copyright © 2025-present dragon-fish
