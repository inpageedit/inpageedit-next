<template>
  <time :datetime="computedDate.toISOString()">{{ displayText }}</time>
</template>

<script lang="ts" setup>
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    date?: string | number | Date | undefined
    options?: Intl.DateTimeFormatOptions | undefined
  }>(),
  {
    date: undefined,
  }
)

const defaultOptions: Intl.DateTimeFormatOptions = {
  dateStyle: 'medium',
  timeStyle: 'medium',
}

const format = new Intl.DateTimeFormat('default', {
  ...defaultOptions,
  ...props.options,
}).format

const computedDate = computed(() => {
  return props.date ? new Date(props.date) : new Date()
})
const displayText = computed(() => {
  return format(computedDate.value)
})
</script>

<style lang="scss"></style>
