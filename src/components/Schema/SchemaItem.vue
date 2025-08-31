<template lang="pug">
NFormItem.schema-item(
  v-show='!schema.meta.hidden',
  :validation-status='status.status',
  :feedback='status.feedback',
  :required='schema.meta.required',
  :class='`schema-type-${schema.type} schema-role-${schema.meta.role || "default"} ${hideLabel ? "schema-without-label" : ""}`'
)
  template(#label, v-if='!hideLabel && !schema.meta.role?.includes("info")')
    slot(name='label')
      NText(v-if='schema.meta.disabled', style='margin-right: 0.5rem'): NIcon: IconLock
      NText
        | {{ schema.meta.description?.toString() }}
        span(v-if='name', style='user-select: none; opacity: 0.5') &nbsp;({{ name }})
  .schema-item-inner
    Component(
      :is='ItemComponent',
      :schema='schema',
      :value='value',
      :placeholder='placeholder',
      :status='status.status',
      :feedback='status.feedback',
      @update:value='$emit("update:value", $event)'
    )
</template>

<script setup lang="ts">
import { computed, defineComponent, h } from 'vue'
import { NFormItem, NGradientText, NText, NIcon } from 'naive-ui'
import { IconLock } from '@tabler/icons-vue'
import type Schema from 'schemastery'
import SchemaArray from './SchemaArray.vue'
import SchemaBoolean from './SchemaBoolean.vue'
import SchemaDict from './SchemaDict.vue'
import SchemaNumber from './SchemaNumber.vue'
import SchemaObject from './SchemaObject.vue'
import SchemaString from './SchemaString.vue'
import SchemaUnion from './SchemaUnion.vue'
import { schemaValidator } from '@/utils/schemaValidator'

const props = defineProps<{
  schema: Schema
  value: any
  name?: string
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:value': [value: any]
}>()

const hideLabel = computed(
  () => typeof props.schema.meta.description === undefined || props.schema.meta.description === ''
)

const ItemComponent = computed(() => {
  switch (props.schema.type) {
    case 'array':
      return SchemaArray
    case 'boolean':
      return SchemaBoolean
    case 'dict':
      return SchemaDict
    case 'number':
      return SchemaNumber
    case 'object':
      return SchemaObject
    case 'string':
      return SchemaString
    case 'union':
      return SchemaUnion
    default:
      return defineComponent({
        render() {
          return h('div', {}, [
            h('pre', { lang: 'json' }, { default: () => JSON.stringify(props.value, null, 2) }),
            h(
              NGradientText,
              { class: 'schema-item-missing-handler', type: 'warning' },
              {
                default: () => `Type "${props.schema.type}" is not supported yet`,
              }
            ),
          ])
        },
      })
  }
})

const status = computed(() => schemaValidator(props.schema, props.value))
</script>

<style scoped lang="sass">
.schema-item
  --border-color: rgba(0, 0, 0, 0.1)
  &:hover
    --border-color: rgba(0, 0, 0, 0.2)
  &:not(:last-of-type)
    margin-bottom: 0.2rem
:global([data-theme="darkTheme"] .schema-item)
  --border-color: rgba(255, 255, 255, 0.1) !important
:global([data-theme="darkTheme"] .schema-item:hover)
  --border-color: rgba(255, 255, 255, 0.4) !important
.schema-item-inner .schema-item-inner
  padding-left: 0.4rem
  transition: border-color 0.24s ease
  border-left: 1px solid var(--border-color)

.schema-role-html-info, schema-role-info
  .schema-item-inner
    border-left: none
    padding-left: 0

.schema-item-inner
  width: 100%
  height: auto
  position: relative

// .schema-type-boolean
//   position: relative
//   :deep(> .n-form-item-blank)
//     min-height: unset
//     position: absolute
//     right: 1em
//     top: 0
//     height: 0

.schema-type-object
  :deep(> .n-form-item-feedback-wrapper)
    display: none

.schema-without-label
  grid-template-rows: auto
</style>
