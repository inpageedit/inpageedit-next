<template lang="pug">
.schema-number
  NDatePicker(
    v-if='schema.meta.role === "date" || schema.meta.role === "datetime"',
    :type='schema.meta.role',
    :value='value',
    @update:value='$emit("update:value", $event || 0)',
    :disabled='schema.meta.disabled',
    clearable
  )
  Component(
    v-else,
    :is='NumberComponent',
    :value='value',
    @update:value='$emit("update:value", $event)',
    :max='max',
    :min='min',
    :step='step',
    :marks='{ ["" + min]: min ?? 0, ["" + max]: max, ["" + value]: value }',
    :disabled='schema.meta.disabled'
  )
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type Schema from 'schemastery'
import { NInputNumber, NSlider, NDatePicker } from 'naive-ui'

const props = defineProps<{
  schema: Schema
  value: number
}>()

const emit = defineEmits<{
  'update:value': [value: number]
}>()

const max = computed(() => props.schema.meta.max)
const min = computed(() => props.schema.meta.min)
const step = computed(() => props.schema.meta.step ?? 1)

const NumberComponent = computed(() => {
  switch (props.schema.meta.role) {
    default:
      return NInputNumber
    case 'slider':
      return NSlider
  }
})
</script>

<style scoped lang="sass"></style>
