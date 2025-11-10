<template lang="pug">
#ipe-registry-manager
  .ipeps-header
    .ipeps-header-title Registries
    .ipeps-input-wrapper
      input.ipeps-input.with-icon(
        v-model.trim='inputValue',
        type='url',
        placeholder='Add registry URL (https://...)',
        :disabled='isAdding'
      )
      .ipeps-input-icon 📦
    UIBaseButton(@click='onAddRegistry', :disabled='isAdding || !inputValue', variant='primary') {{ isAdding ? 'Adding...' : 'Add' }}

  .ipeps-list(v-if='registries.length')
    .ipeps-item(v-for='reg in registries', :key='reg.registryUrl')
      .registry-info
        .item-name {{ reg.label }}
        .item-desc
          .homepage: a(v-if='reg.homepage', :href='reg.homepage', target='_blank') {{ reg.homepage }}
          .url {{ reg.registryUrl }}
        .item-meta {{ reg.packages.length }} packages
      .ipeps-actions
        UIBaseButton(@click='onRemoveRegistry(reg.registryUrl)', variant='danger') Remove
  .ipeps-empty(v-else)
    .icon 🗂️
    .text No registries configured
    .description
      UIBaseButton(
        @click='onAddOfficialRegistry',
        variant='primary',
        style='padding: 0.25rem 0.5rem'
      ) setup default registry
</template>

<script setup lang="ts" vapor>
import { onMounted, ref } from 'vue'
import { h as $ } from 'jsx-dom'
import type { PluginStoreRegistry } from '../schema.js'
import UIBaseButton from './ui/UIBaseButton.vue'

const ctx = useIPE()

interface RegistryViewModel extends PluginStoreRegistry {
  registryUrl: string
  label: string
}

const registries = ref<RegistryViewModel[]>([])
const inputValue = ref('')
const isAdding = ref(false)

const urlToLabel = (u: string) => {
  try {
    return new URL(u).hostname
  } catch {
    return u
  }
}

async function loadRegistries() {
  const urls = (await ctx.preferences.get<string[]>('pluginStore.registries')) || []
  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const info = await ctx.store.getRegistryInfo(url)
      return {
        registryUrl: url,
        label: urlToLabel(url),
        ...info,
      } as RegistryViewModel
    })
  )
  registries.value = results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => (r as PromiseFulfilledResult<RegistryViewModel>).value)
}

async function onAddRegistry() {
  const url = inputValue.value.trim()
  if (!url) return
  if (registries.value.some((r) => r.registryUrl === url)) {
    ctx.modal.notify('info', { content: 'Registry already exists.' })
    return
  }
  isAdding.value = true
  try {
    // try load immediately
    const info = await ctx.store.getRegistryInfo(url, 'online_manifest', true)
    if (!info) {
      throw new Error('Invalid registry or unreachable')
    }
    const current = (await ctx.preferences.get<string[]>('pluginStore.registries')) || []
    current.push(url)
    await ctx.preferences.set('pluginStore.registries', current)
    registries.value.push({
      registryUrl: url,
      label: urlToLabel(url),
      ...info,
    })
    inputValue.value = ''
    ctx.modal.notify('success', { content: 'Registry added.' })
  } catch (e) {
    ctx.modal.notify('error', {
      content: e instanceof Error ? e.message : String(e),
    })
  } finally {
    isAdding.value = false
  }
}

async function removeRegistryUrl(url: string) {
  const current = (await ctx.preferences.get<string[]>('pluginStore.registries')) || []
  const next = current.filter((u) => u !== url)
  await ctx.preferences.set('pluginStore.registries', next)
  registries.value = registries.value.filter((r) => r.registryUrl !== url)
}

async function onRemoveRegistry(url: string) {
  const installed =
    (await ctx.preferences.get<{ registry: string; id: string }[]>('pluginStore.plugins')) || []
  const installedOfReg = installed.filter((p) => p.registry === url)
  if (installedOfReg.length === 0) {
    ctx.modal.confirm(
      {
        title: 'Remove registry',
        content: `Remove registry:\n${url}`,
        cancelBtn: {
          label: 'Cancel',
          className: 'is-ghost',
        },
        okBtn: {
          label: 'Remove',
          className: 'is-danger',
        },
      },
      async (ok) => {
        if (!ok) return
        await removeRegistryUrl(url)
        ctx.modal.notify('success', { content: 'Registry removed.' })
      }
    )
    return
  }

  ctx.modal.dialog(
    {
      title: 'Remove registry',
      // content: `There ${installedOfReg.length === 1 ? 'is' : 'are'} ${installedOfReg.length} installed plugin${installedOfReg.length === 1 ? '' : 's'} from this registry:\n${installedOfReg.map((p) => p.id).join('\n')}`,
      content: $('div', { class: 'theme-ipe-prose' }, [
        $(
          'p',
          {},
          `There ${installedOfReg.length === 1 ? 'is' : 'are'} ${installedOfReg.length} installed plugin${installedOfReg.length === 1 ? '' : 's'} from this registry:`
        ),
        $(
          'ul',
          {},
          installedOfReg.map((p) => $('li', {}, p.id))
        ),
      ]),
      buttons: [
        {
          label: 'Remove only',
          className: 'is-danger is-ghost',
          method: async (_, m) => {
            await removeRegistryUrl(url)
            ctx.modal.notify('success', { content: 'Registry removed.' })
            m.close()
          },
        },
        {
          label: 'Remove and uninstall plugins',
          className: 'is-danger',
          method: async (_, m) => {
            await removeRegistryUrl(url)
            for (const p of installedOfReg) {
              try {
                await ctx.store.uninstallAndRemovePreference(p.registry, p.id)
              } catch (e) {
                // best-effort; notify but continue
                ctx.modal.notify('error', {
                  content:
                    e instanceof Error
                      ? `Failed to uninstall ${p.id}: ${e.message}`
                      : `Failed to uninstall ${p.id}`,
                })
              }
            }
            ctx.modal.notify('success', {
              content: `Registry removed and ${installedOfReg.length} ${installedOfReg.length === 1 ? 'plugin' : 'plugins'} uninstalled.`,
            })
            m.close()
          },
        },
      ],
    },
    () => {}
  )
}

function onPreferencesChanged(payload: { changes: Record<string, unknown> }) {
  const regs = payload.changes['pluginStore.registries'] as string[]
  if (Array.isArray(regs)) {
    loadRegistries()
  }
}

function onAddOfficialRegistry() {
  const url = Endpoints.PLUGIN_REGISTRY_URL
  inputValue.value = url
  onAddRegistry()
}

onMounted(() => {
  loadRegistries()
  ctx.on('preferences/changed', onPreferencesChanged)
})
</script>

<style scoped lang="scss">
@use './style.scss' as *;

.registry-info {
  flex: 1;
  min-width: 0;
}
</style>
