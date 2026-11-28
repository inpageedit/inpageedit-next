# MediaWiki 链接识别

## 目标

让快速差异和快速编辑识别 MediaWiki 实际生成的差异链接和源码编辑链接。

## 决定

- 使用已有 siteinfo 中的 `general.script` 生成 index 入口 URL，并精确匹配入口的 origin 和路径。访问 translatewiki 时，项目使用它配置的 `/w/i.php`。其他脚本的 URL 生成沿用 `scriptpath`。
- 用当前访问域名解析页面链接。若它与 siteinfo 的 `server` 不同，识别链接时将当前域名映射到 `server`。解析结果保留页面链接的域名、路径和参数。
- `veaction=editsource` 触发快速编辑。`veaction=edit` 继续交给 VisualEditor。显式 `action` 优先。

## 验收

- 标准 index 入口、改名的 index 入口、短链接和站点首页均能解析。匹配入口时忽略查询参数和锚点。
- 对采用 `/wiki/$1` 条目路径的站点，`api.php`、`load.php` 和其他站外链接均不会挂载快速差异按钮。
- 访问域名和 `server` 不一致时，页面差异链接能挂载快速差异按钮。
