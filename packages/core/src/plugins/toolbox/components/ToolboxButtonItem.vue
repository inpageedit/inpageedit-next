<template lang="pug">
li.btn-tip-group(
  :id='normalizedId'
  :data-id='button.id'
  :data-index='button.index'
  :style='delayStyle'
  v-bind='sanitizedItemProps'
)
  .btn-tip(ref='tipEl')
  button.ipe-toolbox-btn(
    :id='normalizedId + "-btn"'
    :data-id='button.id'
    @click='handleClick'
    v-bind='filteredButtonProps'
    ref='btnEl'
  )
</template>

<script setup lang="ts" vapor>
import { computed, onMounted, ref, watch } from 'vue'
import { normalizeButtonId, type ToolboxButton } from '../index.js'

const props = defineProps<{
  button: ToolboxButton
  delay: number
  i18nVersion: number
}>()

const emit = defineEmits<{
  'button-click': [event: MouseEvent, button: ToolboxButton]
}>()

const tipEl = ref<HTMLElement>()
const btnEl = ref<HTMLElement>()

const normalizedId = computed(() => normalizeButtonId(props.button.id))

const delayStyle = computed(() => ({
  '--transition-delay': `${props.delay}s`,
  '--max-transition-delay': '0.15s',
}))

// Sanitize props to avoid type conflicts between jsx-dom types and Vue template types
const sanitizedItemProps = computed(() => {
  if (!props.button.itemProps) return {}
  const { style, class: cls, className, ...rest } = props.button.itemProps as Record<string, any>
  return rest
})

const filteredButtonProps = computed(() => {
  if (!props.button.buttonProps) return {}
  const { onClick, style, class: cls, className, ...rest } = props.button.buttonProps as Record<
    string,
    any
  >
  return rest
})

const resolvedIcon = computed(() => {
  void props.i18nVersion
  const icon = props.button.icon
  return typeof icon === 'function' ? icon() : icon
})

const resolvedTooltip = computed(() => {
  void props.i18nVersion
  const tooltip = props.button.tooltip
  return typeof tooltip === 'function' ? tooltip() : tooltip
})

function applyDomContent(el: HTMLElement | undefined, value: unknown) {
  if (!el) return
  while (el.firstChild) el.removeChild(el.firstChild)
  if (value == null) return
  if (typeof value === 'string') {
    el.textContent = value
  } else if (value instanceof Node) {
    el.appendChild(value.cloneNode(true))
  }
}

function handleClick(event: MouseEvent) {
  props.button.onClick?.(event)
  emit('button-click', event, props.button)
}

onMounted(() => {
  applyDomContent(btnEl.value, resolvedIcon.value)
  applyDomContent(tipEl.value, resolvedTooltip.value)
})

watch(resolvedIcon, (val) => applyDomContent(btnEl.value, val))
watch(resolvedTooltip, (val) => applyDomContent(tipEl.value, val))
</script>
