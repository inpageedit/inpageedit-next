<template lang="pug">
#ipe-plugin-install-manager
  .ipeps-header
    .ipeps-header-title Plugins
    .ipeps-input-wrapper
      input.ipeps-input.with-icon(
        v-model.trim='searchInput',
        type='text',
        placeholder='Search plugins...',
        :disabled='!allPluginsToDisplay.length'
      )
      .ipeps-input-icon 🔍
    button.ipeps-button(
      @click='refreshRegistries',
      :disabled='isRefreshing || !hasRegistries',
      :class='{ refreshing: isRefreshing }',
      variant='primary'
    ) {{ isRefreshing ? 'Refreshing...' : 'Refresh' }}

  .ipeps-loading(v-if='!hasRegistries && !firstInit')
    .loading-spinner
    .loading-text Loading...

  .ipeps-list(v-else-if='allPluginsToDisplay.length')
    .ipeps-item(
      v-for='plugin in allPluginsToDisplay',
      :key='plugin._key',
      :class='{ installed: isInstalledKey(plugin._key), broken: plugin.isBroken }'
    )
      .plugin-info
        .plugin-header
          .item-name {{ plugin.name || plugin.id }}
          span.ipeps-badge(
            v-if='isInstalledKey(plugin._key) || plugin.isBroken',
            :class='{ "is-installed": isInstalledKey(plugin._key), "is-broken": plugin.isBroken }'
          ) {{ plugin.isBroken ? '⚠️ broken' : '✓' }}
        .ipeps-tags
          a.ipeps-tag.registry-tag(
            v-if='plugin.registryHomepage && !plugin.isRegistryMissing',
            :href='plugin.registryHomepage',
            target='_blank',
            :title='plugin.registryLabel'
          ) {{ plugin.registryLabel }}
          span.ipeps-tag.registry-tag(
            v-else,
            :title='plugin.registryLabel',
            :class='{ broken: plugin.isRegistryMissing }'
          ) {{ plugin.registryLabel }}
          .plugin-id.ipeps-tag(:class='{ broken: plugin.isBroken && !plugin.isRegistryMissing }') {{ plugin.id }}
        .plugin-desc(:class='{ "broken-desc": plugin.isBroken }') {{ getDesc(plugin) }}
        .plugin-meta
          span.version(v-if='plugin.version') v{{ plugin.version }}
          span.author(v-if='plugin.author') 👤 {{ plugin.author }}
          span.license(v-if='plugin.license') 📜 {{ plugin.license }}
      UIBaseButton(
        :active='isInstalledKey(plugin._key)',
        :variant='isInstalledKey(plugin._key) ? "danger" : "primary"',
        @click='togglePluginByKey(plugin)'
      ) {{ isInstalledKey(plugin._key) ? 'Remove' : 'Install' }}

  .ipeps-empty(v-else)
    .plugin-empty-icon 📦
    .plugin-empty-text No matching plugins found
</template>

<script setup lang="ts" vapor>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { PluginStoreRegistry } from '../schema.js'
import UIBaseButton from './ui/UIBaseButton.vue'

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

const firstInit = ref(false)
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
  if (registryInfos.value.length === 0) {
    ctx.modal.notify('info', {
      content: 'No registry configured. Please add a registry first.',
    })
    return
  }

  isRefreshing.value = true
  const results = await ctx.store.refreshAllRegistryCaches()
  const okResults = Object.entries(results).filter(([_, r]) => r !== null)
  registryInfos.value = okResults.map(([url, r]) => ({
    ...r!,
    registryUrl: url,
  }))
  const failedUrls = Object.entries(results)
    .filter(([_, r]) => r === null)
    .map(([url]) => url)
  isRefreshing.value = false

  if (okResults.length === 0) {
    ctx.modal.notify('error', {
      content: 'All registries failed to refresh',
    })
  } else {
    ctx.modal.notify('success', {
      content: `${okResults.length} ${okResults.length === 1 ? 'registry' : 'registries'} refreshed successfully.`,
    })
    if (failedUrls.length > 0) {
      ctx.modal.notify('warning', {
        content: `${failedUrls.length} ${failedUrls.length === 1 ? 'registry' : 'registries'} failed to refresh:\n${failedUrls.join('\n')}`,
      })
    }
  }
}

// init
const init = async () => {
  firstInit.value = false
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

  installedPlugins.value = (await ctx.preferences.get('pluginStore.plugins')) || []

  firstInit.value = true
}

function onPreferencesChanged(payload: { changes: Record<string, unknown> }) {
  const regs = payload.changes['pluginStore.registries'] as string[]
  const plugins = payload.changes['pluginStore.plugins'] as PluginIdentifier[]
  if (Array.isArray(plugins)) installedPlugins.value = plugins
  if (Array.isArray(regs)) {
    init()
  }
}

onMounted(() => {
  init()
  ctx.on('preferences/changed', onPreferencesChanged)
})
onBeforeUnmount(() => {})
</script>

<style scoped lang="scss">
@use './style.scss' as *;

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
.registry-tag {
  color: var(--ipe-modal-accent);
  background: color-mix(in srgb, var(--ipe-modal-accent) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--ipe-modal-accent) 20%, transparent);
  &.broken {
    text-decoration: line-through;
    opacity: 0.7;
    cursor: not-allowed;
  }
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
</style>
