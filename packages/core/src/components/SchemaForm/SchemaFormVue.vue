<template>
  <schema-form ref="elRef" v-bind="$attrs" />
</template>

<script setup lang="ts">
import type Schema from 'schemastery'
import './index' // 注册自定义元素
import { SchemaForm, type SchemaFormChangeEvent } from './index'
import { onMounted, onBeforeUnmount, watch, nextTick, useTemplateRef } from 'vue'

// Props 定义
interface Props {
  schema: Schema<any>
  value?: any
  validateOnChange?: boolean
}

const { validateOnChange = false } = defineProps<Props>()
const schema = defineModel<Schema>('schema', { required: true })
const value = defineModel<any>('value', { required: false, default: {} })

// Emits 定义
const emit = defineEmits<{
  change: [detail: SchemaFormChangeDetail<any>]
}>()

// Template refs
const elRef = useTemplateRef('elRef')

// 临时状态标志，避免竞态条件
let isUpdatingFromComponent = false
let isUpdatingFromProps = false

const onFormChange = (e: SchemaFormChangeEvent) => {
  if (isUpdatingFromProps) {
    // 如果正在从外部props更新，忽略此次组件内部变更事件
    return
  }

  const node = elRef.value!
  const next = validateOnChange
    ? node.getData({ validate: true })
    : node.getData({ validate: false, autofix: true })

  // 设置标志，避免watch触发更新
  isUpdatingFromComponent = true
  value.value = next
  // 在下一个微任务中重置标志
  nextTick(() => {
    isUpdatingFromComponent = false
  })

  emit('change', e.detail)
}

onMounted(() => {
  const node = elRef.value!
  if (schema.value) node.schema = schema.value
  if (value.value !== undefined) node.setData(value.value, { validate: false, autofix: true })
  node.addEventListener('form-change', onFormChange as any)
})

onBeforeUnmount(() => {
  elRef.value?.removeEventListener('form-change', onFormChange as any)
})

// 外部变更 -> 同步进 web component（避免循环，按引用判断）
watch(
  () => schema,
  (s) => {
    if (isUpdatingFromComponent) return
    if (elRef.value && s && elRef.value.schema !== s.value) {
      isUpdatingFromProps = true
      elRef.value.schema = s.value
      nextTick(() => {
        isUpdatingFromProps = false
      })
    }
  },
  { deep: false }
)

watch(
  () => value,
  (d) => {
    if (isUpdatingFromComponent) return
    if (!elRef.value) return
    // 为了避免无意义的重渲染，只在引用或浅比较不等时设置
    if (d.value === undefined) return

    // 获取当前 Web Component 内的数据
    const currentData = elRef.value.getData({ validate: false })

    // 深度比较，如果数据实际上没有变化，则不调用 setData
    if (JSON.stringify(currentData) === JSON.stringify(d.value)) {
      return
    }

    isUpdatingFromProps = true
    elRef.value.setData(d.value, { validate: false })
    nextTick(() => {
      isUpdatingFromProps = false
    })
  },
  { deep: true }
)

// 暴露实例方法（TS 友好）
defineExpose({
  /** 手动设置数据并可选择是否触发 v-model:data */
  setData(v: any, opts?: { validate?: boolean; emit?: boolean }) {
    const node = elRef.value!
    node.setData(v, { validate: !!opts?.validate })
    if (opts?.emit) {
      value.value = node.getData({ validate: !!opts?.validate })
    }
  },
  /** 获取数据 */
  getData(opts?: { validate?: boolean }) {
    return elRef.value!.getData(opts)
  },
  /** 设置 schema，并同步到 v-model:schema */
  setSchema(s: Schema<any>, emitUpdate = true) {
    elRef.value!.schema = s
    if (emitUpdate) {
      schema.value = s
    }
  },
  refresh() {
    elRef.value!.refresh()
  },
  reset() {
    elRef.value!.reset()
  },
  /** 原生元素 */
  el: elRef,
})
</script>
