<template lang="pug">
.schema-union
  NCheckboxGroup(
    v-if='schema.meta.role === "multiselect"',
    :value='value',
    @update:value='$emit("update:value", $event)',
    :max='schema.meta.max',
    :disabled='schema.meta.disabled'
  )
    NSpace
      NCheckbox(v-for='i in schema.list', :value='i.value')
        Component(:is='renderLabel(i)')
  NDatePicker(v-else-if='schema.meta.role === "datetime"', :disabled='schema.meta.disabled')
  NRadioGroup(
    v-else-if='schema.meta.role === "radio"',
    :value='value',
    @update:value='$emit("update:value", $event)',
    :disabled='schema.meta.disabled'
  )
    NSpace
      NRadio(v-for='i in schema.list', :value='i.value')
        Component(:is='renderLabel(i)')
  NSelect(
    v-else,
    :options='options',
    :value='value',
    @update:value='$emit("update:value", $event)',
    :disabled='schema.meta.disabled'
  )
</template>

<script setup lang="ts">
import { computed, h } from 'vue'
import type Schema from 'schemastery'
import {
  NText,
  type SelectOption,
  NCheckbox,
  NCheckboxGroup,
  NDatePicker,
  NSpace,
  NRadio,
  NRadioGroup,
  NSelect,
} from 'naive-ui'

const props = defineProps<{
  schema: Schema
  value: any
}>()

defineEmits<{
  'update:value': [value: any]
}>()

const options = computed<SelectOption[]>(() => {
  return (props.schema.list || [])?.map((ref) => {
    return {
      label: renderLabel(ref),
      value: ref.value,
    }
  })
})

function renderLabel(ref: Schema) {
  return () =>
    ref.meta.description
      ? h(
          NText,
          {},
          {
            default() {
              return [
                ref.meta.description,
                h(NText, { depth: 3 }, { default: () => ` (${ref.value})` }),
              ]
            },
          }
        )
      : h(NText, {}, { default: () => ref.value })
}
</script>

<style scoped lang="sass"></style>
