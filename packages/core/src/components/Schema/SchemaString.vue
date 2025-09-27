<template lang="pug">
.schema-string
  .raw-html-info(v-if='schema.meta.role === "html-info"')
    div(v-html='schema.meta.description')
  .raw-text-info(v-else-if='schema.meta.role === "info"')
    div {{ schema.meta.description }}
  .plain-text-input(v-else)
    NInputGroup
      NButton(
        v-if='["url", "image-url"].includes(schema.meta.role || "")',
        :size='schema.meta.role === "image-url" ? "small" : "medium"',
        :render-icon='() => h(IconLink)',
        :type='status',
        :disabled='schema.meta.disabled || checkURL(value) !== "success"',
        @click='openLinkPreview(value)'
      )
      NInput(
        :disabled='schema.meta.disabled',
        :size='schema.meta.role === "image-url" ? "small" : "medium"',
        :type='inputType',
        :value='value',
        :placeholder='placeholder',
        @update:value='$emit("update:value", $event)',
        clearable,
        :maxlength='schema.meta.max || undefined',
        :minlength='schema.meta.min || undefined',
        :show-count='schema.meta.max || schema.meta.min ? true : false'
      )
    //- NDatePicker(
    //-   v-if='schema.meta.role === "datetime"',
    //-   :formatted-value='value',
    //-   value-format='yyyy-MM-dd"T"HH:mm:ss.SSSxxx',
    //-   @update:formatted-value='$emit("update:value", $event)'
    //- )
</template>

<script setup lang="ts">
import { computed, h, onBeforeMount, ref } from 'vue'
import type Schema from 'schemastery'
import { NButton, NInputGroup, NInput } from 'naive-ui'
import { IconLink } from '@tabler/icons-vue'
import { checkURL, openLinkPreview } from '@/utils/schemaValidator'

const props = defineProps<{
  schema: Schema
  value: string
  status?: 'success' | 'error'
  feedback?: string
  placeholder?: string
}>()
const emit = defineEmits<{
  'update:value': [value: string]
}>()

const inputType = computed(() => {
  switch (props.schema.meta.role) {
    case 'textarea':
    case 'password':
      return props.schema.meta.role
    default:
      return 'text'
  }
})

onBeforeMount(() => {
  if (typeof props.value !== 'string') {
    console.warn(`SchemaString: value is ${props.value}, set to ''`)
    emit('update:value', '')
  }
})
</script>

<style scoped lang="sass"></style>
