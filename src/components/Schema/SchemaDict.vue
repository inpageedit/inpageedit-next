<template lang="pug">
.schema-dict
  NGradientText(type='warning') 警告：类型 Dict 目前处于实验阶段，可能会有不稳定的行为
  NDynamicInput(
    :default-value='initialValue',
    @update:value='handleUpdateValue',
    preset='pair'
  )
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Schema from 'schemastery'
import { NDynamicInput, NGradientText } from 'naive-ui'

const props = withDefaults(
  defineProps<{
    schema: Schema
    value: Record<string, any>
    status?: 'success' | 'error'
    feedback?: string
    placeholder?: string
  }>(),
  {
    value: {} as any,
  }
)
const emit = defineEmits<{
  'update:value': [value: Record<string, any>]
}>()

const initialValue = ref(
  Object.keys(props.value).map((key) => {
    return { key, value: props.value[key] }
  })
)

function handleUpdateValue(value: { key: string; value: string }[]) {
  const dict: any = {}
  value.forEach((item) => {
    dict[item.key] = item.value
  })
  emit('update:value', dict)
}
</script>

<style scoped lang="sass"></style>
