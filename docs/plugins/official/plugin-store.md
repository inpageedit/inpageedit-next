---
title: 插件商店 Plugin Store
---

# 插件商店 Plugin Store

**插件商店** (plugin-store) 是 InPageEdit 的插件市场，用于发现、安装和管理社区提供的第三方插件。

## 使用方式

### 通过偏好设置访问

插件商店作为偏好设置的一个标签页存在。打开偏好设置弹窗后，切换到「插件商店」标签即可浏览和管理插件。

### 功能特性

- **注册表管理**：支持添加多个插件注册表源
- **插件浏览**：从注册表中浏览可用插件
- **一键安装/卸载**：安装的插件自动持久化到偏好设置，下次加载时自动恢复
- **缓存机制**：注册表信息缓存在 IndexedDB 中（TTL 24 小时），支持手动刷新

### 插件加载方式

插件商店支持多种加载模式：

| 模式 | 说明 |
|------|------|
| `autoload` | 通过 `<script>` 标签加载（传统方式） |
| `module` | 通过 ES Module `import()` 动态加载 |
| `umd` | 加载 UMD 脚本后从 `globalThis` 获取导出 |
| `styles` | 仅加载样式文件，无脚本 |

## 配置项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `pluginStore.registries` | `string[]` | *(内置注册表 URL)* | 注册表 URL 列表（隐藏项） |
| `pluginStore.cdnForNpm` | `string` | `jsdelivr` | npm 包的 CDN 模板（隐藏项） |
| `pluginStore.plugins` | `array` | `[]` | 已安装的插件列表（隐藏项，自动管理） |

## For Developers

### Public API

```ts
// Install a plugin from a registry
ctx.store.install(registry: string, id: string, source?: 'online_manifest' | 'npm', by?: 'new-added' | 'user-preference'): Promise<ForkScope | null>

// Uninstall a plugin
ctx.store.uninstall(registry: string, id: string): Promise<boolean>

// Install + persist to preferences
ctx.store.installAndSetPreference(registry: string, id: string): Promise<ForkScope | null>

// Uninstall + remove from preferences
ctx.store.uninstallAndRemovePreference(registry: string, id: string): Promise<boolean>

// Preference management
ctx.store.addToPreferences(registry: string, id: string): Promise<boolean>
ctx.store.removeFromPreferences(registry: string, id: string): Promise<boolean>

// Registry operations
ctx.store.getRegistryInfo(registry: string, source?: string, noCache?: boolean): Promise<PluginStoreRegistry>
ctx.store.validateRegistry(data: any): PluginStoreRegistry
ctx.store.refreshRegistryCache(registry: string): Promise<PluginStoreRegistry>
ctx.store.refreshAllRegistryCaches(): Promise<Record<string, PluginStoreRegistry | null>>
ctx.store.clearAllRegistryCaches(): Promise<void>

// Show store UI
ctx.store.showModal(): Promise<IPEModal>
```

### Events

| Event | Description |
|-------|-------------|
| `plugin-store/registry-fetched` | Registry data fetched and validated. Payload: `{ ctx, registry }` |
| `plugin-store/registry-not-found` | Registry fetch failed and no cache available. Payload: `{ ctx, registryUrl }` |
| `plugin-store/registry-removed` | Registry cache deleted. Payload: `{ ctx, registryUrl }` |
| `plugin-store/plugin-installed` | Plugin installed. Payload: `{ ctx, registry, id, by }` |
| `plugin-store/plugin-uninstalled` | Plugin uninstalled. Payload: `{ ctx, registry, id }` |
