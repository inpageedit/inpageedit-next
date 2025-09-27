<template lang="pug">
.schema-form-full
  NForm.schema-form-form(:model='value')
    .flex.gap-1
      NCard.schema-form-main.flex-1
        template(#header): slot(name='header')
        slot(name='prefix')
        SchemaItem.flex-1(
          :schema='schema',
          :value='value',
          @update:value='$emit("update:value", $event)',
          @update:status='$emit("update:status", $event)'
        )
        slot(name='suffix')
        template(#action)
          .flex
            .actions
              slot(name='action')
            .flex-1
            .actions-extra
              slot(name='action-extra')
</template>

<script setup lang="ts">
import { NForm, NCard } from 'naive-ui'
import SchemaItem from './SchemaItem.vue'
import type Schema from 'schemastery'

const props = defineProps<{
  schema: Schema
  value: any
  showDebug?: boolean
}>()

const emit = defineEmits<{
  'update:value': [value: any]
  'update:status': [status: string]
}>()
</script>

<style scoped lang="sass">
.schema-form-main
  > :deep(.n-card__content)
    padding: 1rem

:global(.n-modal-body-wrapper .schema-form-form .n-card__action)
  margin: -1.5rem
  margin-top: 0
</style>
