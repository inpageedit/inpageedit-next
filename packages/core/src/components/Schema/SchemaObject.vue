<template lang="pug">
.schema-object
  SchemaItem(
    v-if='value',
    v-for='(item, key) in schema.dict',
    :key='key',
    :name='key',
    :schema='item',
    :value='value[key]',
    @update:value='handleUpdateValue(key, $event)'
  )
</template>

<script setup lang="ts">
import { onBeforeMount } from 'vue'
import type Schema from 'schemastery'
import SchemaItem from './SchemaItem.vue'

const props = defineProps<{
  schema: Schema
  value: any
}>()

const emit = defineEmits<{
  'update:value': [value: any]
}>()

function handleUpdateValue(index: string, val: any) {
  props.value[index] = val
}

onBeforeMount(() => {
  if (props.value === undefined || props.value === null) {
    console.warn(`SchemaObject: value is ${props.value}, set to {}`)
    emit('update:value', {})
  }
})
</script>

<style scoped lang="sass"></style>
