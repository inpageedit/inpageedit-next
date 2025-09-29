<template lang="pug">
.ipe-progress-bar(
  role='progressbar',
  :aria-valuenow='value',
  aria-valuemin='0',
  aria-valuemax='100',
  :style='{ "--progress": value ? value + "%" : undefined }',
  :class='indeterminate ? "indeterminate" : "determinate"'
)
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'

export interface ProgressBarProps {
  progress?: number
  indeterminate?: boolean
}
const emit = defineEmits<{
  'update:indeterminate': [boolean]
}>()

const progress = defineModel<ProgressBarProps['progress']>('progress', { default: -1 })
const indeterminate = defineModel<ProgressBarProps['indeterminate']>('indeterminate', {
  default: false,
})

const value = computed(() => {
  if (indeterminate.value) return undefined
  if (typeof progress.value === 'undefined' || progress.value === null) return 0
  if (progress.value < 0) return 0
  if (progress.value > 100) return 100
  return +progress.value
})

watch(
  () => progress.value,
  (newVal) => {
    if (newVal === -1 || typeof newVal === 'undefined' || newVal === null) {
      indeterminate.value = true
    } else {
      indeterminate.value = false
    }
  },
  { immediate: true }
)

function setProgress(p: number | undefined) {
  progress.value = p
}
defineExpose({ setProgress })
</script>

<style scoped lang="sass">
:global(:host)
  display: block
  line-height: 0
  width: 100%
  height: 1em

.ipe-progress-bar
  --progress: 0%
  position: relative
  display: inline-block
  width: 100%
  height: 100%
  border: 1px solid #c5c5c5
  border-radius: 100vmax
  background-color: #fff
  overflow: hidden

  &.indeterminate
    &::before, &::after
      content: ''
      position: absolute
      top: 0
      bottom: 0
      left: 0
      background-color: #36c
    &::before
      animation: progress-indeterminate-long 2s linear infinite
    &::after
      animation: progress-indeterminate-short 2s linear infinite
  &.determinate
    &::before
      content: ''
      position: absolute
      top: 0
      bottom: 0
      left: 0
      width: var(--progress)
      background-color: #36c
      transition: width 0.3s ease-in-out

@keyframes progress-indeterminate-long
  0%
    left: 0
    width: 0

  50%
    left: 30%
    width: 70%

  75%
    left: 100%
    width: 0

@keyframes progress-indeterminate-short
  0%
    left: 0
    width: 0

  50%
    left: 0
    width: 0

  75%
    left: 0
    width: 25%

  100%
    left: 110%
    width: 0
</style>
