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

  template(v-for='reg in regs', :key='reg.name')
    SchemaFormVue(
      v-show='activeCategoryName === reg.category',
      :schema='reg.schema',
      v-model:value='value',
      :validate-on-change='false',
      :i18n='{ rootLabel: "" }'
    )

  details
    summary Debug Info
    pre(style='max-height: 20em; overflow: auto') {{ activeSchema }}
    pre(style='max-height: 20em; overflow: auto') {{ value }}
</template>

<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef, watchEffect } from 'vue'
import { useIPE } from '@/utils/vueHooks'
import type { InPageEditPreferenceUIRegistryItem, InPageEditPreferenceUICategory } from '../index'
import SchemaFormVue from '@/components/SchemaForm/SchemaFormVue.vue'
import Schema from 'schemastery'

const ctx = useIPE()!

const tabs = ref<InPageEditPreferenceUICategory[]>([])
const activeCategoryName = ref('')
const activeSchema = computed(() => {
  return regs.value.find((r) => r.category === activeCategoryName.value)?.schema as Schema
})

const value = ref<any>({})
const regs = ref<InPageEditPreferenceUIRegistryItem[]>([])

defineExpose({
  getValue() {
    return deepToRaw(value)
  },
})

watchEffect(() => {
  activeCategoryName.value &&
    (regs.value = ctx.preferences.getConfigRegistries(activeCategoryName.value))
})

onMounted(async () => {
  ctx.inject(['preferences'], async (ctx) => {
    value.value = await ctx.preferences.getAll()
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
  .tab
    padding: 0.25em 0.5em
    cursor: pointer
    user-select: none
    color: var(--tab-color)
    display: inline-block
    transition: color 0.3s ease, box-shadow 0.3s ease
    &.active
      color: var(--active-color)
      box-shadow: inset 0 -0.15em 0 0 var(--active-color)
</style>
