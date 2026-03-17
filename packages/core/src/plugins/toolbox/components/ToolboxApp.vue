<template lang="pug">
ul.btn-group.group1(style='display: flex; flex-direction: column')
  ToolboxButtonItem(
    v-for='(btn, idx) in sortedGroup1'
    :key='btn.id'
    :button='btn'
    :delay='getDelay(idx, sortedGroup1.length)'
    :i18n-version='i18nVersion'
    @button-click='onButtonClick'
  )
ul.btn-group.group2(style='display: flex; flex-direction: row')
  ToolboxButtonItem(
    v-for='(btn, idx) in sortedGroup2'
    :key='btn.id'
    :button='btn'
    :delay='getDelay(idx, sortedGroup2.length)'
    :i18n-version='i18nVersion'
    @button-click='onButtonClick'
  )
button.ipe-toolbox-btn#toolbox-toggler(@click='state.onToggle()')
  //- Font Awesome 5 Solid: Plus
  svg(xmlns='http://www.w3.org/2000/svg' width='448' height='512' viewBox='0 0 448 512')
    rect(width='448' height='512' fill='none')
    path(fill='currentColor' d='M416 208H272V64c0-17.67-14.33-32-32-32h-32c-17.67 0-32 14.33-32 32v144H32c-17.67 0-32 14.33-32 32v32c0 17.67 14.33 32 32 32h144v144c0 17.67 14.33 32 32 32h32c17.67 0 32-14.33 32-32V304h144c17.67 0 32-14.33 32-32v-32c0-17.67-14.33-32-32-32')
</template>

<script setup lang="ts" vapor>
import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue'
import { TOOLBOX_STATE_KEY, type ToolboxButton } from '../index.js'
import ToolboxButtonItem from './ToolboxButtonItem.vue'

const state = inject(TOOLBOX_STATE_KEY)!
const ctx = useIPE()
const i18nVersion = ref(0)

let i18nDispose: (() => void) | null = null

onMounted(() => {
  i18nDispose = ctx.on('i18n/changed', () => {
    i18nVersion.value++
  })
})

onBeforeUnmount(() => {
  i18nDispose?.()
})

// Sorted button groups
const sortedGroup1 = computed(() =>
  state.buttons.value.filter((b) => b.group === 'group1').sort(state.compareButtons)
)

const sortedGroup2 = computed(() =>
  state.buttons.value.filter((b) => b.group === 'group2').sort(state.compareButtons)
)

// Staggered animation delay calculation
function getDelay(index: number, totalCount: number): number {
  if (totalCount <= 1) return 0
  const totalDuration = 0.15
  const normalizedIndex = index / (totalCount - 1)
  const delay = totalDuration * Math.sqrt(normalizedIndex)
  return Math.round(delay * 1000) / 1000
}

// Forward button click to service
function onButtonClick(event: MouseEvent, button: ToolboxButton) {
  state.onButtonClick(event, button)
}
</script>
