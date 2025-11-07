<template lang="pug">
.preferences-ui-app
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
      SchemaFormVue(
        v-for='(schema, index) in activeSchemas',
        :key='`${activeCategoryName}-${index}`',
        :schema='schema',
        :value='initialValue',
        @update:value='value = $event',
        :validate-on-change='false',
        :i18n='{ rootLabel: "" }'
      )

  details(v-if='DEV')
    pre(style='max-height: 20em; overflow: auto') {{ value }}
</template>

<script setup lang="ts" vapor>
import { computed, onMounted, ref, watch, shallowRef } from 'vue'
import { useIPE } from '@/utils/vueHooks'
import type {
  InPageEditPreferenceUIRegistryItem,
  InPageEditPreferenceUICategory,
} from '../../services/PreferencesService'
import SchemaFormVue from 'schemastery-form/vue'

const ctx = useIPE()!
const DEV = import.meta.env.DEV

const tabs = ref<InPageEditPreferenceUICategory[]>([])
const activeCategoryName = ref('')
const activeRegistries = shallowRef<InPageEditPreferenceUIRegistryItem[]>([])
const activeSchemas = computed(() => activeRegistries.value.map((reg) => reg.schema))

/**
 * 为什么要维护两个 value：
 * 存在多个 SchemaForm 共享一个 value 的竞态问题
 * 为了避免这种情况，我们维护两个 value：
 * 1. initialValue - 用于初始化表单
 * 2. value - 用于保存原始值，表单更新时，我们先更新 value
 * 3. 在切换标签页等 UI 整体重新渲染的时候，我们再同步 initialValue 的值
 */
const initialValue = shallowRef<any>({})
const value = shallowRef<any>({})

defineExpose({
  getValue() {
    return deepToRaw(value)
  },
  updateValue(details: Record<string, unknown>) {
    console.info('request to update value', details)
    initialValue.value = {
      ...initialValue.value,
      ...details,
    }
    value.value = {
      ...value.value,
      ...details,
    }
  },
})

watch(
  activeCategoryName,
  (newCategory) => {
    if (newCategory) {
      initialValue.value = value.value
      activeRegistries.value = ctx.preferences.getConfigRegistries(newCategory)
    }
  },
  { immediate: true }
)

onMounted(async () => {
  ctx.inject(['preferences'], async (ctx) => {
    const all = await ctx.preferences.getAll()
    initialValue.value = value.value = all
    tabs.value = ctx.preferences.getConfigCategories()
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
</script>

<style scoped lang="scss">
.tabbar {
  .tabbar-tabs {
    --border-color: #efefef;
    --tab-color: #666;
    --active-color: #3366bb;
    display: flex;
    gap: 0.5em;
    border-bottom: 1px solid #efefef;
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
.preferences-ui-app {
  .schema-form-item.field {
    border: 0;
  }
}
</style>
