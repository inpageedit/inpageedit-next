<template lang="pug">
.preferences-ui-app
  NTabs(type='line', v-model:value='activeTabIndex')
    NTab(v-for='tab in tabs', :name='tab.name', :tab='tab.label')

  SchemaItem(v-if='regs', v-for='reg in regs', :schema='reg.schema', v-model:value='value')

  details
    pre {{ value }}
</template>

<script setup lang="ts">
import { onMounted, ref, watchEffect } from 'vue'
import { useIPE } from './hooks'
import { NTab, NTabs } from 'naive-ui'
import SchemaItem from '@/components/Schema/SchemaItem.vue'
import type { InPageEditPreferenceUIRegistryItem, InPageEditPreferenceUICategory } from '../index'

const ctx = useIPE()!

const tabs = ref<InPageEditPreferenceUICategory[]>([])
const activeTabIndex = ref('')

const value = ref<any>({})
const regs = ref<InPageEditPreferenceUIRegistryItem[]>([])

defineExpose({
  getValue() {
    return value.value
  },
})

watchEffect(() => {
  activeTabIndex.value && (regs.value = ctx.preferences.getConfigRegistries(activeTabIndex.value))
})

onMounted(async () => {
  ctx.inject(['preferences'], async (ctx) => {
    value.value = await ctx.preferences.getAll()
    tabs.value = ctx.preferences.getConfigCategories()
    activeTabIndex.value = tabs.value[0].name
  })
})
</script>

<style scoped lang="sass"></style>
