<template lang="pug">
#preferences-ui-app
  .tabbar
    .tabbar-tabs
      a.tab(
        v-for='tab in tabs',
        :key='tab.name',
        :class='{ active: activeCategoryName === tab.name }',
        @click='handleTabClick($event, tab.name)',
        :data-value='tab.name'
      ) {{ tab.label }}

    .tabbar-content
      .custom-render-container(
        ref='customRenderContainerRef',
        :key='activeCategoryName',
        v-if='activeCategory && activeCategory.customRenderer'
      )
      SchemaFormVue.auto-schema-form(
        v-if='autoGenerateForm && activeSchema',
        :key='activeCategoryName',
        :data-category='activeCategoryName',
        :schema='activeSchema',
        :value='value',
        @update:value='value = { ...value, ...$event }',
        :validate-on-change='false',
        :i18n='{ rootLabel: "" }'
      )

  details(v-if='DEV')
    pre(style='max-height: 20em; overflow: auto') {{ value }}
</template>

<script setup lang="ts" vapor>
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  shallowRef,
  useTemplateRef,
  watch,
} from 'vue'
import { useIPE } from '@/utils/vueHooks'
import type {
  InPageEditPreferenceUIRegistryItem,
  InPageEditPreferenceUICategory,
} from '../../../services/PreferencesService'
import SchemaFormVue from 'schemastery-form/vue'
import Schema from 'schemastery'

const ctx = useIPE()!
const DEV = import.meta.env.DEV

const registries = shallowRef<InPageEditPreferenceUIRegistryItem[]>([])
const tabs = ref<InPageEditPreferenceUICategory[]>([])
const activeCategoryName = ref('')
const activeCategory = computed(() => {
  return tabs.value.find((tab) => tab.name === activeCategoryName.value) || null
})
const activeSchema = computed(() => {
  const filtered = registries.value
    .filter((reg) => reg.category === activeCategoryName.value)
    .map((reg) => reg.schema)
  if (filtered.length === 0) return null
  return Schema.intersect(filtered)
})

const autoGenerateForm = computed(() => {
  if (!activeCategory.value) return true
  return typeof activeCategory.value.autoGenerateForm === 'boolean'
    ? activeCategory.value.autoGenerateForm
    : true
})

const value = ref<any>({})

defineExpose({
  getValue() {
    return deepToRaw(value)
  },
  mergeValue(details: Record<string, unknown>) {
    console.info('request to update value', details)
    value.value = {
      ...value.value,
      ...details,
    }
  },
  selectTab(name: string) {
    activeCategoryName.value = name
  },
})

onMounted(async () => {
  ctx.inject(['preferences'], async (ctx) => {
    const all = await ctx.preferences.getAll()
    value.value = all
    tabs.value = ctx.preferences.getConfigCategories()
    registries.value = ctx.preferences.getConfigRegistries()
    activeCategoryName.value = tabs.value[0].name
  })
})

const handleTabClick = (event: MouseEvent, name: string) => {
  event.preventDefault()
  activeCategoryName.value = name
  const target = event.currentTarget as HTMLAnchorElement
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }
}

const customRenderContainerRef = useTemplateRef('customRenderContainerRef')
const unmountCallbacks = ref<Array<() => void>>([])

onUnmounted(() => {
  // 组件卸载时调用所有注册的卸载回调
  unmountCallbacks.value.forEach((callback) => callback())
  unmountCallbacks.value = []
})

watch(
  activeCategory,
  async (cat) => {
    // 调用之前注册的卸载回调
    unmountCallbacks.value.forEach((callback) => callback())
    unmountCallbacks.value = []

    await nextTick()
    const container = customRenderContainerRef.value
    if (!container) return
    container.innerText = ''
    if (cat && typeof cat.customRenderer === 'function') {
      let onMountedCallback: (container: HTMLElement) => void = noop
      const onMounted = (callback: (container: HTMLElement) => void) => {
        onMountedCallback = callback
      }
      const onUnmount = (callback: () => void) => {
        unmountCallbacks.value.push(callback)
      }
      const node = await cat.customRenderer({ ctx, onMounted, onUnmount })
      if (node) {
        container.appendChild(node)
        onMountedCallback?.(container)
      }
    }
  },
  { immediate: true, deep: false }
)
</script>

<style scoped lang="scss">
.tabbar {
  .tabbar-tabs {
    --border-color: #efefef;
    --tab-color: #666;
    --active-color: #3366bb;
    display: flex;
    gap: 0.5em;
    border-bottom: 1px solid var(--border-color);
    margin-bottom: 1em;
    white-space: nowrap;
    overflow-x: auto;
    .tab {
      padding: 0.5em 1em;
      cursor: pointer;
      user-select: none;
      color: var(--tab-color);
      display: inline-block;
      transition:
        color 0.3s ease,
        box-shadow 0.3s ease;
      &.active {
        color: var(--active-color);
        box-shadow: inset 0 -0.15em 0 0 var(--active-color);
      }
    }
  }
}

schema-form {
  margin-bottom: 0.5em;
  --schema-radius: 6px;
}
</style>

<style lang="scss">
#preferences-ui-app {
  .schema-form-item.field {
    border: 0;
  }
}
</style>
