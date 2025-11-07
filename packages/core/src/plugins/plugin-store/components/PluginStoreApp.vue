<template lang="pug">
#ipe-plugin-store-app
  h2 Plugin Store
  .placeholder(v-if='!registryInfo') Loading registry...
  div(v-else)
    ul
      li(v-for='plugin in registryInfo.packages', :key='plugin.id')
        h3 {{ plugin.name }}
        .actions
          button(
            v-if='!isInstalled(registryUrl, plugin.id)',
            @click='enablePlugin(registryUrl, plugin.id)'
          ) Enable
          button(v-else, @click='disablePlugin(registryUrl, plugin.id)') Disable
</template>

<script setup lang="ts" vapor>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { PluginStoreRegistry } from '../schema.js'

const { registryUrl } = defineProps<{
  registryUrl: string
}>()

const ctx = useIPE()
const registryInfo = ref<PluginStoreRegistry | null>(null)
const installedPlugins = ref<string[]>([])

const isInstalled = (registry: string, id: string) => {
  return installedPlugins.value.includes(`${registry}:${id}`)
}

const initRegistry = async () => {
  await ctx.store
    .getRegistryInfo(registryUrl)
    .then((info) => {
      registryInfo.value = info
    })
    .catch((e) => {
      ctx.logger.warn('Failed to load registry', e)
      ctx.modal.notify('error', {
        title: 'Failed to load registry',
        content: e instanceof Error ? e.message : String(e),
      })
    })
}
onMounted(async () => {
  await initRegistry()
})

const enablePlugin = async (registry: string, id: string) => {
  ctx.store.installAndSetPreference(registry, id)
}
const disablePlugin = async (registry: string, id: string) => {
  ctx.store.uninstallAndRemovePreference(registry, id)
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
onBeforeUnmount(() => {
  console.info('unmount plugin store app', ctx)
  // ctx?.off && ctx.off('preferences/changed', onPreferencesChanged)
})
</script>

<style scoped lang="scss"></style>
