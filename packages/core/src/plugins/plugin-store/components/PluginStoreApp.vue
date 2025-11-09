<template lang="pug">
#ipe-plugin-store-app
  .store-header
    .store-search-wrapper
      input.store-search-input(
        v-model.trim='searchInput',
        type='text',
        placeholder='Search plugins...',
        :disabled='!hasRegistries'
      )
      .store-search-icon 🔍
    button.store-refresh-btn(
      @click='refreshRegistries',
      :disabled='isRefreshing',
      :class='{ refreshing: isRefreshing }'
    )
      span.refresh-text {{ isRefreshing ? 'Refreshing...' : 'Refresh' }}

  .store-loading(v-if='!hasRegistries')
    .loading-spinner
    .loading-text Loading...

  .store-plugins(v-else-if='allPluginsToDisplay.length')
    .plugin-item(
      v-for='plugin in allPluginsToDisplay',
      :key='plugin._key',
      :class='{ installed: isInstalledKey(plugin._key), broken: plugin.isBroken }'
    )
      .plugin-info
        .plugin-header
          .name {{ plugin.name || plugin.id }}
          span.badge(
            v-if='isInstalledKey(plugin._key) || plugin.isBroken',
            :class='{ "is-installed": isInstalledKey(plugin._key), "is-broken": plugin.isBroken }'
          ) {{ plugin.isBroken ? '⚠️ broken' : '✓' }}
        .plugin-tags
          a.registry-tag(
            v-if='plugin.registryHomepage && !plugin.isRegistryMissing',
            :href='plugin.registryHomepage',
            target='_blank',
            :title='plugin.registryLabel'
          ) {{ plugin.registryLabel }}
          span.registry-tag(
            v-else,
            :title='plugin.registryLabel',
            :class='{ broken: plugin.isRegistryMissing }'
          ) {{ plugin.registryLabel }}
          .plugin-id(:class='{ broken: plugin.isBroken && !plugin.isRegistryMissing }') {{ plugin.id }}
        .plugin-desc(:class='{ "broken-desc": plugin.isBroken }') {{ getDesc(plugin) }}
        .plugin-meta
          span.version(v-if='plugin.version') v{{ plugin.version }}
          span.author(v-if='plugin.author') 👤 {{ plugin.author }}
          span.license(v-if='plugin.license') 📜 {{ plugin.license }}
      button(:class='{ active: isInstalledKey(plugin._key) }', @click='togglePluginByKey(plugin)') {{ isInstalledKey(plugin._key) ? 'Remove' : 'Install' }}

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
interface PluginIdentifier {
  registry: string
  id: string
}

// --- state ---
const ctx = useIPE()
const registryInfos = ref<RegistryWithUrl[]>([])
const installedPlugins = ref<PluginIdentifier[]>([])
const searchInput = ref('')
const isRefreshing = ref(false)

// helpers
const makeKey = (r: string, id: string) => `${r}\n${id}` // stable + O(1)

const installedKeySet = computed(
  () => new Set(installedPlugins.value.map((p) => makeKey(p.registry, p.id)))
)
const isInstalledKey = (key: string) => installedKeySet.value.has(key)

const urlToLabel = (registryUrl: string) => {
  try {
    return new URL(registryUrl).hostname
  } catch {
    return registryUrl
  }
}

const hasRegistries = computed(() => registryInfos.value.length > 0)

// merge normal + broken, and normalize once here
const normalizedPlugins = computed(() => {
  const q = searchInput.value.trim().toLowerCase()

  const all: Array<any> = registryInfos.value.flatMap((reg) =>
    (reg.packages || []).map((pkg) => ({
      ...pkg,
      _key: makeKey(reg.registryUrl, pkg.id),
      registry: reg.registryUrl,
      registryHomepage: reg.homepage,
      registryLabel: urlToLabel(reg.registryUrl),
      isBroken: false,
      isRegistryMissing: false,
    }))
  )

  // broken installed plugins (installed but not available now)
  const availableKeys = new Set(all.map((p) => p._key))
  const availableRegs = new Set(registryInfos.value.map((r) => r.registryUrl))

  const broken = installedPlugins.value
    .filter((p) => !availableKeys.has(makeKey(p.registry, p.id)))
    .map((p) => {
      const regInfo = registryInfos.value.find((r) => r.registryUrl === p.registry)
      return {
        id: p.id,
        name: undefined,
        description: undefined,
        version: undefined,
        author: undefined,
        license: undefined,
        _key: makeKey(p.registry, p.id),
        registry: p.registry,
        registryHomepage: regInfo?.homepage,
        registryLabel: urlToLabel(p.registry),
        isBroken: true,
        isRegistryMissing: !availableRegs.has(p.registry),
      }
    })

  const filtered = (list: any[]) => {
    if (!q) return list
    return list.filter(
      (p) =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.id && p.id.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.author && p.author.toLowerCase().includes(q)) ||
        (p.registry && p.registry.toLowerCase().includes(q))
    )
  }

  // broken on top
  return [...filtered(broken), ...filtered(all)]
})

const allPluginsToDisplay = computed(() => normalizedPlugins.value)

const getDesc = (p: any) => {
  if (p.description) return p.description
  if (!p.isBroken) return ''
  return p.isRegistryMissing
    ? '[Recommend to uninstall] The registry is unavailable. Try refreshing or re-adding the registry to fix this issue.'
    : '[Recommend to uninstall] This plugin was removed from the registry. Try refreshing the registry to confirm.'
}

// actions
const enablePlugin = async (registry: string, id: string) => {
  ctx.store.installAndSetPreference(registry, id)
}
const disablePlugin = async (registry: string, id: string) => {
  ctx.store.uninstallAndRemovePreference(registry, id)
}
const togglePlugin = (registry: string, id: string) =>
  isInstalledKey(makeKey(registry, id)) ? disablePlugin(registry, id) : enablePlugin(registry, id)
const togglePluginByKey = (p: any) => togglePlugin(p.registry, p.id)

const refreshRegistries = async () => {
  if (isRefreshing.value) return
  isRefreshing.value = true
  try {
    const urls = (await ctx.store.ctx.preferences.get('pluginStore.registries')) || []
    const results = await Promise.allSettled(
      urls.map(async (url: string) => ({
        ...(await ctx.store.refreshRegistryCache(url)),
        registryUrl: url,
      }))
    )
    registryInfos.value = results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<RegistryWithUrl>).value)
    ctx.modal.notify('success', { content: `${urls.length} registries refreshed successfully` })
  } catch (e) {
    ctx.modal.notify('error', { content: 'Failed to refresh registries' })
  } finally {
    setTimeout(() => {
      isRefreshing.value = false
    }, 3000)
  }
}

// init
const init = async () => {
  const urls = (await ctx.store.ctx.preferences.get('pluginStore.registries')) || []
  const regResults = await Promise.allSettled(
    urls.map(async (url: string) => ({
      ...(await ctx.store.getRegistryInfo(url)),
      registryUrl: url,
    }))
  )
  registryInfos.value = regResults
    .filter((r) => r.status === 'fulfilled')
    .map((r) => (r as PromiseFulfilledResult<RegistryWithUrl>).value)

  installedPlugins.value = (await ctx.store.ctx.preferences.get('pluginStore.plugins')) || []
}

function onPreferencesChanged(payload: { changes: Record<string, unknown> }) {
  const plugins = payload.changes['pluginStore.plugins'] as PluginIdentifier[]
  if (Array.isArray(plugins)) installedPlugins.value = plugins
}

onMounted(() => {
  init()
  ctx.on('preferences/changed', onPreferencesChanged)
  console.info('mount plugin store app', ctx)
})
onBeforeUnmount(() => {
  console.info('unmount plugin store app', ctx)
})
</script>

<style scoped lang="scss">
$transition-default: all 0.2s ease;
$border-width: 1.5px;
$tag-radius: 3px;

#ipe-plugin-store-app {
  padding: var(--ipe-modal-spacing);
  font-size: 0.875rem;
  color: var(--ipe-modal-text);
}

// Header（修正拼写：store-header）
.store-header {
  margin-bottom: 1.25rem;
  display: flex;
  align-items: center;
  gap: var(--ipe-modal-spacing);
  .store-search-wrapper {
    flex: 1;
    position: relative;
  }
  .store-search-input {
    width: 100%;
    height: 2.5rem;
    padding: 0 0.875rem 0 2.5rem;
    border: $border-width solid var(--ipe-modal-border-color);
    border-radius: var(--ipe-modal-button-radius);
    font-size: 0.875rem;
    outline: none;
    background: var(--ipe-modal-bg);
    color: var(--ipe-modal-text);
    transition: $transition-default;
    line-height: 1.5;
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
  .store-refresh-btn {
    height: 2.5rem;
    padding: 0 1rem;
    border: $border-width solid var(--ipe-modal-border-color);
    border-radius: var(--ipe-modal-button-radius);
    background: var(--ipe-modal-bg);
    color: var(--ipe-modal-text);
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    white-space: nowrap;
    transition: $transition-default;
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

// Loading / Empty 共用
.store-loading,
.plugin-empty {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}
.store-loading {
  padding: 10rem 1.25rem;
}
.store-loading .loading-spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid var(--ipe-modal-border-color);
  border-top-color: var(--ipe-modal-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.store-loading .loading-text,
.plugin-empty .plugin-empty-text {
  color: var(--ipe-modal-muted);
  font-size: 0.875rem;
}
.plugin-empty {
  padding: 3rem 1.25rem;
}
.plugin-empty .plugin-empty-icon {
  font-size: 3rem;
  opacity: 0.3;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

// 列表
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
  border: $border-width solid var(--ipe-modal-border-color);
  border-radius: calc(var(--ipe-modal-button-radius) + 2px);
  background: var(--ipe-modal-secondary-bg);
  transition: $transition-default;
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
    }
  }
  &.broken {
    background: color-mix(in srgb, var(--ipe-modal-warning) 5%, var(--ipe-modal-secondary-bg));
    border-color: color-mix(in srgb, var(--ipe-modal-warning) 50%, var(--ipe-modal-border-color));
    border-style: dashed;
    &:hover {
      background: color-mix(in srgb, var(--ipe-modal-warning) 8%, var(--ipe-modal-secondary-bg));
      border-color: var(--ipe-modal-warning);
      box-shadow: 0 2px 8px color-mix(in srgb, var(--ipe-modal-warning) 15%, transparent);
    }
  }
  .plugin-info {
    flex: 1;
    min-width: 0;
  }
  .plugin-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }
  .name {
    font-weight: 600;
    font-size: 1rem;
    color: var(--ipe-modal-text);
    line-height: 1.2;
  }

  // badge 合并
  .badge {
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 0.125rem 0.375rem;
    border-radius: calc(var(--ipe-modal-button-radius) - 2px);
    line-height: 1;
  }
  .badge.is-installed {
    color: var(--ipe-modal-success);
    background: color-mix(in srgb, var(--ipe-modal-success) 15%, transparent);
  }
  .badge.is-broken {
    color: var(--ipe-modal-warning);
    background: color-mix(in srgb, var(--ipe-modal-warning) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--ipe-modal-warning) 30%, transparent);
  }

  // tags
  .plugin-id,
  .registry-tag {
    font-size: 0.6875rem;
    font-family: monospace;
    margin-bottom: 0.375rem;
    padding: 0.125rem 0.375rem;
    border-radius: $tag-radius;
    display: inline-block;
  }
  .plugin-id {
    font-size: 0.75rem;
    color: var(--ipe-modal-muted);
    background: color-mix(in srgb, var(--ipe-modal-muted) 5%, transparent);
    margin-left: 0.375rem;
  }
  .registry-tag {
    color: var(--ipe-modal-accent);
    background: color-mix(in srgb, var(--ipe-modal-accent) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--ipe-modal-accent) 20%, transparent);
  }
  .plugin-id.broken,
  .registry-tag.broken {
    text-decoration: line-through;
    opacity: 0.7;
  }
  .registry-tag.broken {
    cursor: not-allowed;
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
  }
  .plugin-meta .version {
    font-family: monospace;
    font-weight: 500;
  }
  .plugin-meta .author {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  // action button
  button {
    padding: 0.5rem 1.25rem;
    border: $border-width solid var(--ipe-modal-accent);
    border-radius: var(--ipe-modal-button-radius);
    background: var(--ipe-modal-bg);
    color: var(--ipe-modal-accent);
    cursor: pointer;
    font-size: 0.8125rem;
    font-weight: 500;
    white-space: nowrap;
    transition: $transition-default;
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
</style>
