<template lang="pug">
#ipe-plugin-store-app
  .sotre-header
    .store-search-wrapper(v-if='registryInfos.length > 0')
      input.store-search-input(v-model='searchInput', type='text', placeholder='Search plugins...')
      .store-search-icon 🔍
    button.store-refresh-btn(
      @click='refreshRegistries',
      :disabled='isRefreshing',
      :class='{ refreshing: isRefreshing }'
    )
      span.refresh-text {{ isRefreshing ? 'Refreshing...' : 'Refresh' }}

  .store-loading(v-if='registryInfos.length === 0')
    .loading-spinner
    .loading-text Loading...

  .store-plugins(v-else-if='filteredPlugins.length > 0')
    .plugin-item(
      v-for='plugin in filteredPlugins',
      :key='`${plugin.registry}:${plugin.id}`',
      :class='{ installed: isInstalled(plugin.registry, plugin.id) }'
    )
      .plugin-info
        .plugin-header
          .name {{ plugin.name }}
          .status-badge(v-if='isInstalled(plugin.registry, plugin.id)') ✓
        .plugin-id {{ plugin.id }}
        .registry-tag {{ getRegistryLabel(plugin.registry) }}
        .plugin-desc(v-if='plugin.description') {{ plugin.description }}
        .plugin-meta
          span.version(v-if='plugin.version') v{{ plugin.version }}
          span.author(v-if='plugin.author') 👤 {{ plugin.author }}
      button(
        :class='{ active: isInstalled(plugin.registry, plugin.id) }',
        @click='togglePlugin(plugin.registry, plugin.id)'
      ) {{ isInstalled(plugin.registry, plugin.id) ? 'Remove' : 'Install' }}

  .plugin-empty(v-else)
    .plugin-empty-icon 📦
    .plugin-empty-text No matching plugins found
</template>

<script setup lang="ts" vapor>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { PluginStoreRegistry } from '../schema.js'

interface RegistryWithUrl extends PluginStoreRegistry {
  registryUrl: string
}

const ctx = useIPE()
const registryInfos = ref<RegistryWithUrl[]>([])
const installedPlugins = ref<string[]>([])
const searchInput = ref('')
const isRefreshing = ref(false)

onMounted(async () => {
  await initRegistries()
})

const initRegistries = async () => {
  const registryUrls = (await ctx.store.ctx.preferences.get('pluginStore.registries')) || []

  const results = await Promise.allSettled(
    registryUrls.map(async (url) => {
      const info = await ctx.store.getRegistryInfo(url)
      return { ...info, registryUrl: url }
    })
  )

  registryInfos.value = results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => (r as PromiseFulfilledResult<RegistryWithUrl>).value)
}

const isInstalled = (registry: string, id: string) => {
  return installedPlugins.value.includes(`${registry}:${id}`)
}

// 获取仓库标签显示名称
const getRegistryLabel = (registryUrl: string) => {
  try {
    const url = new URL(registryUrl)
    return url.hostname
  } catch {
    return registryUrl
  }
}

// 搜索过滤 - 合并所有仓库的插件
const filteredPlugins = computed(() => {
  // 合并所有仓库的packages,并添加registry信息（使用完整的registryUrl）
  const allPlugins = registryInfos.value.flatMap((registry) =>
    (registry.packages || []).map((pkg) => ({
      ...pkg,
      registry: registry.registryUrl, // 使用完整的 registry URL (index.json 地址)
    }))
  )

  if (!searchInput.value.trim()) return allPlugins

  const query = searchInput.value.toLowerCase()
  return allPlugins.filter((plugin) => {
    return (
      plugin.name?.toLowerCase().includes(query) ||
      plugin.id?.toLowerCase().includes(query) ||
      plugin.description?.toLowerCase().includes(query) ||
      plugin.author?.toLowerCase().includes(query)
    )
  })
})

const enablePlugin = async (registry: string, id: string) => {
  ctx.store.installAndSetPreference(registry, id)
}
const disablePlugin = async (registry: string, id: string) => {
  ctx.store.uninstallAndRemovePreference(registry, id)
}

// 切换插件状态
const togglePlugin = (registry: string, id: string) => {
  if (isInstalled(registry, id)) {
    disablePlugin(registry, id)
  } else {
    enablePlugin(registry, id)
  }
}

// 刷新所有 registry 缓存
const refreshRegistries = async () => {
  if (isRefreshing.value) return

  isRefreshing.value = true
  try {
    const registryUrls = (await ctx.store.ctx.preferences.get('pluginStore.registries')) || []

    const results = await Promise.allSettled(
      registryUrls.map(async (url) => {
        const info = await ctx.store.refreshRegistryCache(url)
        return { ...info, registryUrl: url }
      })
    )

    registryInfos.value = results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<RegistryWithUrl>).value)

    ctx.modal.notify('success', {
      content: `${registryUrls.length} registries refreshed successfully`,
    })
  } catch (error) {
    ctx.modal.notify('error', {
      content: 'Failed to refresh registries',
    })
  } finally {
    setTimeout(() => {
      isRefreshing.value = false
    }, 3000)
  }
}

// init plugin states
const initInstalStatus = async () => {
  const prefs = (await ctx.store.ctx.preferences.get('pluginStore.plugins')) || []
  installedPlugins.value = prefs.map((p) => `${p.registry}:${p.id}`)
}
function onPreferencesChanged(payload: { changes: Record<string, unknown> }) {
  const plugins = payload.changes['pluginStore.plugins'] as {
    registry: string
    id: string
  }[]
  if (plugins && Array.isArray(plugins)) {
    installedPlugins.value = plugins.map((p) => `${p.registry}:${p.id}`)
  }
}
onMounted(() => {
  initInstalStatus()
  ctx.on('preferences/changed', onPreferencesChanged)
})

onMounted(() => {
  console.info('mount plugin store app', ctx)
})
onBeforeUnmount(() => {
  console.info('unmount plugin store app', ctx)
})
</script>

<style scoped lang="scss">
#ipe-plugin-store-app {
  padding: var(--ipe-modal-spacing);
  font-size: 0.875rem;
  color: var(--ipe-modal-text);
}

.sotre-header {
  margin-bottom: 1.25rem;
  display: flex;
  align-items: center;
  gap: var(--ipe-modal-spacing);

  h2 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--ipe-modal-text);
  }

  .store-search-wrapper {
    flex: 1;
    position: relative;

    .store-search-input {
      width: 100%;
      padding: 0.5rem 0.875rem 0.5rem 2.5rem;
      border: 1.5px solid var(--ipe-modal-border-color);
      border-radius: calc(var(--ipe-modal-button-radius) + 2px);
      font-size: 0.875rem;
      outline: none;
      background: var(--ipe-modal-bg);
      color: var(--ipe-modal-text);
      transition: all 0.2s ease;

      &:focus {
        border-color: var(--ipe-modal-accent);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--ipe-modal-accent) 10%, transparent);
      }

      &::placeholder {
        color: var(--ipe-modal-muted);
      }
    }

    .store-search-icon {
      position: absolute;
      left: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
      opacity: 0.5;
    }
  }

  .store-refresh-btn {
    padding: 0.5rem 1rem;
    border: 1.5px solid var(--ipe-modal-border-color);
    border-radius: var(--ipe-modal-button-radius);
    background: var(--ipe-modal-bg);
    color: var(--ipe-modal-text);
    cursor: pointer;
    font-size: 0.8125rem;
    font-weight: 500;
    white-space: nowrap;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.375rem;

    &:hover:not(:disabled) {
      background: var(--ipe-modal-secondary-bg);
      border-color: var(--ipe-modal-accent);
      transform: translateY(-1px);
      box-shadow: 0 2px 6px color-mix(in srgb, var(--ipe-modal-text) 10%, transparent);
    }

    &:active:not(:disabled) {
      transform: translateY(0);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }
}

.store-loading {
  padding: 3rem 1.25rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;

  .loading-spinner {
    width: 2rem;
    height: 2rem;
    border: 3px solid var(--ipe-modal-border-color);
    border-top-color: var(--ipe-modal-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .loading-text {
    color: var(--ipe-modal-muted);
    font-size: 0.875rem;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.store-plugins {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.plugin-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.875rem;
  border: 1.5px solid var(--ipe-modal-border-color);
  border-radius: calc(var(--ipe-modal-button-radius) + 2px);
  background: var(--ipe-modal-secondary-bg);
  position: relative;
  transition: all 0.2s ease;

  &:hover {
    background: var(--ipe-modal-divider-color);
    border-color: color-mix(in srgb, var(--ipe-modal-accent) 30%, var(--ipe-modal-border-color));
    box-shadow: 0 2px 8px color-mix(in srgb, var(--ipe-modal-text) 5%, transparent);
  }

  &.installed {
    background: color-mix(in srgb, var(--ipe-modal-success) 5%, var(--ipe-modal-secondary-bg));
    border-color: color-mix(in srgb, var(--ipe-modal-success) 50%, var(--ipe-modal-border-color));

    &:hover {
      background: color-mix(in srgb, var(--ipe-modal-success) 8%, var(--ipe-modal-secondary-bg));
      border-color: var(--ipe-modal-success);
      box-shadow: 0 2px 8px color-mix(in srgb, var(--ipe-modal-success) 15%, transparent);
    }
  }

  .plugin-info {
    flex: 1;
    min-width: 0;

    .plugin-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.25rem;

      .name {
        font-weight: 600;
        font-size: 0.9375rem;
        color: var(--ipe-modal-text);
      }

      .status-badge {
        font-size: 0.6875rem;
        color: var(--ipe-modal-success);
        font-weight: 600;
        background: color-mix(in srgb, var(--ipe-modal-success) 15%, transparent);
        padding: 0.125rem 0.375rem;
        border-radius: calc(var(--ipe-modal-button-radius) - 2px);
        line-height: 1;
      }
    }

    .plugin-id {
      font-size: 0.75rem;
      color: var(--ipe-modal-muted);
      font-family: monospace;
      margin-bottom: 0.375rem;
      background: color-mix(in srgb, var(--ipe-modal-muted) 5%, transparent);
      padding: 0.125rem 0.375rem;
      border-radius: 3px;
      display: inline-block;
    }

    .registry-tag {
      font-size: 0.6875rem;
      color: var(--ipe-modal-accent);
      font-family: monospace;
      margin-bottom: 0.375rem;
      background: color-mix(in srgb, var(--ipe-modal-accent) 10%, transparent);
      padding: 0.125rem 0.375rem;
      border-radius: 3px;
      display: inline-block;
      margin-left: 0.375rem;
      border: 1px solid color-mix(in srgb, var(--ipe-modal-accent) 20%, transparent);
    }

    .plugin-desc {
      font-size: 0.8125rem;
      color: var(--ipe-modal-muted);
      margin-bottom: 0.375rem;
      line-height: 1.5;
    }

    .plugin-meta {
      font-size: 0.75rem;
      color: var(--ipe-modal-muted);
      display: flex;
      gap: 1rem;

      .version {
        font-family: monospace;
        font-weight: 500;
      }

      .author {
        display: flex;
        align-items: center;
        gap: 0.25rem;
      }
    }
  }

  button {
    padding: 0.5rem 1.25rem;
    border: 1.5px solid var(--ipe-modal-accent);
    border-radius: var(--ipe-modal-button-radius);
    background: var(--ipe-modal-bg);
    color: var(--ipe-modal-accent);
    cursor: pointer;
    font-size: 0.8125rem;
    font-weight: 500;
    white-space: nowrap;
    transition: all 0.2s ease;

    &:hover {
      background: var(--ipe-modal-accent);
      color: var(--ipe-modal-bg);
      transform: translateY(-1px);
      box-shadow: 0 2px 6px color-mix(in srgb, var(--ipe-modal-accent) 25%, transparent);
    }

    &:active {
      transform: translateY(0);
    }

    &.active {
      border-color: var(--ipe-modal-danger);
      color: var(--ipe-modal-danger);

      &:hover {
        background: var(--ipe-modal-danger);
        color: var(--ipe-modal-bg);
        box-shadow: 0 2px 6px color-mix(in srgb, var(--ipe-modal-danger) 25%, transparent);
      }
    }
  }
}

.plugin-empty {
  padding: 3rem 1.25rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;

  .plugin-empty-icon {
    font-size: 3rem;
    opacity: 0.3;
  }

  .plugin-empty-text {
    color: var(--ipe-modal-muted);
    font-size: 0.9375rem;
  }
}
</style>
