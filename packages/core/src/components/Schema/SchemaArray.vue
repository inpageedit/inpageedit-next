<template lang="pug">
.schema-array
  .schema-array-tags(v-if='schema.meta.role === "tags"')
    NDynamicTags(
      :value='value',
      @update:value='!schema.meta.disabled ? $emit("update:value", $event) : void 0'
    )
      template(#input='{ submit, deactivate }')
        NAutoComplete(
          size='small',
          v-model:value='autoCompleteInput',
          :options='autoCompleteOptions',
          :render-tag='renderTag',
          clear-after-select,
          @select='submit($event)',
          @blur='deactivate'
        )
    NPopover(v-if='listOfStringConsts?.length')
      template(#trigger): NText(
        depth='3',
        style='font-size: 0.5rem; cursor: help'
      )
        NIcon: IconInfoCircleFilled
        | &nbsp;Options cheatsheet
      template(#default)
        .flex.flex-wrap(style='gap: 0.4rem'): NTag(
          v-for='i in listOfStringConsts',
          size='tiny'
        ) {{ i.value }}
        NText(v-if='canInputEveryThing', depth='3') ...or anything else

  .schema-array-multiselect(v-else-if='schema.meta.role === "multiselect"')
    NCheckboxGroup(
      :value='value',
      @update:value='$emit("update:value", $event)',
      :disabled='schema.meta.disabled'
    )
      NScrollbar(style='max-height: 10rem', trigger='none')
        .checkbox-group-grid
          NCheckbox(v-for='i in innerSchema.list', :value='i.value')
            | {{ i.meta.description || i.value }}
            NText(v-if='i.meta.description', depth='3')
              | &nbsp;({{ i.value }})

  .schema-array-default(v-else)
    NDynamicInput(
      show-sort-button,
      :value='value',
      @update:value='$emit("update:value", $event)',
      :disabled='schema.meta.disabled'
    )
      template(#default='{ value, index }')
        SchemaItem.schema-array-inner(
          :schema='innerSchema',
          :value='value',
          @update:value='handleInnerUpdate(index, $event)'
        )
</template>

<script setup lang="ts">
import { computed, h, ref } from 'vue'
import type Schema from 'schemastery'
import SchemaItem from './SchemaItem.vue'
import {
  NText,
  NAutoComplete,
  type AutoCompleteOption,
  NTag,
  NIcon,
  NDynamicInput,
  NCheckboxGroup,
  NDynamicTags,
  NPopover,
  NScrollbar,
} from 'naive-ui'
import { IconInfoCircleFilled } from '@tabler/icons-vue'

const props = defineProps<{
  schema: Schema
  value: any
}>()

const innerSchema = computed(() => {
  return props.schema.inner!
})

// tags
const listOfStringConsts = computed(() => {
  return props.schema?.inner?.list?.filter(
    ({ type, value }) => type === 'const' && typeof value === 'string'
  )
})
const autoCompleteInput = ref('')
const canInputEveryThing = computed(() => {
  return !!(
    props.schema.inner?.type === 'string' ||
    props.schema.inner?.list?.some(({ type }) => type === 'string') ||
    props.schema.inner?.list?.some(({ type }) => type === 'number')
  )
})
const renderTag = (tag: string, index: number) =>
  h(
    NTag,
    {
      type: ['success', 'warning', 'error', 'info'][index % 4] as any,
      closable: true,
      onClose: () => {
        props.value.value.splice(index, 1)
      },
    },
    {
      default: () => tag,
    }
  )
const autoCompleteOptions = computed<AutoCompleteOption[]>(() => {
  if (!autoCompleteInput.value) return []
  const userInputOption: AutoCompleteOption = {
    label: autoCompleteInput.value,
    value: autoCompleteInput.value,
  }
  const allRelatedOptions: AutoCompleteOption[] =
    listOfStringConsts.value?.map(({ value, meta }) => {
      return {
        label: meta.description || value,
        value: value,
      }
    }) || []
  const optionsStartsWith: AutoCompleteOption[] = allRelatedOptions.filter(({ value }) =>
    value!.toLowerCase().startsWith(autoCompleteInput.value.toLowerCase())
  )
  const optionsIncludes: AutoCompleteOption[] = allRelatedOptions.filter(({ value }) =>
    value!.toLowerCase().includes(autoCompleteInput.value.toLowerCase())
  )

  const options = [...optionsStartsWith, ...optionsIncludes]
  if (canInputEveryThing.value) options.push(userInputOption)

  return [...new Set(options)].filter(({ value }) => !props.value.includes(value))
})

defineEmits<{
  'update:value': [value: any]
}>()

function handleInnerUpdate(index: string, val: any) {
  props.value[index] = val
}
</script>

<style scoped lang="sass">
.schema-array-inner
  display: block
  flex: 1
  :deep(.n-form-item-feedback-wrapper),
  :deep(.n-form-item-label)
    display: none

.checkbox-group-grid
  display: grid
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr))
  gap: 0.5rem
  white-space: nowrap
</style>
