<template lang="pug">
.preferences-ui-app
  .tabs
    a.tab(
      v-for='tab in tabs',
      :key='tab.name',
      :class='{ active: activeCategoryName === tab.name }',
      @click='activeCategoryName = tab.name',
      :data-value='tab.name'
    ) {{ tab.label }}

  SchemaFormVue(
    v-for='(schema, index) in activeSchemas',
    :key='`${activeCategoryName}-${index}`',
    :schema='schema',
    :value='formData',
    @update:value='lazyValue = $event',
    :validate-on-change='false',
    :i18n='{ rootLabel: "" }'
  )

  details(v-if='DEV')
    pre(style='max-height: 20em; overflow: auto') {{ lazyValue }}
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
 * 1. formData：用于表单的 value
 * 2. lazyValue：用于保存原始值，每次表单更新时，我们都会先更新 lazyValue
 * 3. 切换标签页时，我们会懒更新 formData，这样既能同步表单值，又能避免竞态问题
 * 在 getValue 时，我们返回 lazyValue
 */
const formData = shallowRef<any>({})
const lazyValue = shallowRef<any>({})

defineExpose({
  getValue() {
    return deepToRaw(lazyValue)
  },
})

watch(
  activeCategoryName,
  (newCategory) => {
    if (newCategory) {
      formData.value = lazyValue.value
      activeRegistries.value = ctx.preferences.getConfigRegistries(newCategory)
    }
  },
  { immediate: true }
)

onMounted(async () => {
  ctx.inject(['preferences'], async (ctx) => {
    const all = await ctx.preferences.getAll()
    formData.value = lazyValue.value = all
    tabs.value = ctx.preferences.getConfigCategories()
    activeCategoryName.value = tabs.value[0].name
  })
})
</script>

<style scoped lang="sass">
.tabs
  --border-color: #efefef
  --tab-color: #666
  --active-color: #3366bb
  display: flex
  gap: 0.5em
  border-bottom: 1px solid #efefef
  margin-bottom: 1em
  white-space: nowrap
  overflow-x: auto
  .tab
    padding: 0.5em 1em
    cursor: pointer
    user-select: none
    color: var(--tab-color)
    display: inline-block
    transition: color 0.3s ease, box-shadow 0.3s ease
    &.active
      color: var(--active-color)
      box-shadow: inset 0 -0.15em 0 0 var(--active-color)
</style>
