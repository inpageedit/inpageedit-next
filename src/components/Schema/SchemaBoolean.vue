<template lang="pug">
.schema-boolean
  NSwitch(
    :value='value',
    :indeterminate='typeof value === "undefined" || value === null',
    @update:value='schema.meta.disabled ? void 0 : $emit("update:value", $event)'
  )
</template>

<script setup lang="ts">
import {} from 'vue'
import { NSwitch } from 'naive-ui'
import type Schema from 'schemastery'

const props = defineProps<{
  schema: Schema
  value: boolean
}>()

defineEmits<{
  'update:value': [value: boolean]
}>()
</script>

<style scoped lang="sass">
.schema-boolean
  // position: absolute
  // width: 100%
  // right: 1.5em
  // top: -2em
</style>
