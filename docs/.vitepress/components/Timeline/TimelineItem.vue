<template>
  <li class="timeline-item">
    <div class="timeline-info">
      <span v-if="computedTime">
        <DateFormat :date="computedTime" />
      </span>
      <slot v-else name="info">
        <span>{{ info }}</span>
      </slot>
    </div>
    <div class="timeline-marker"></div>
    <div class="timeline-content">
      <component class="timeline-title" :is="titleTag" :id="itemId || title">
        <slot name="title">
          {{ title }}
        </slot>
      </component>
      <p>
        <slot name="content">
          <slot name="default">
            {{ content }}
          </slot>
        </slot>
      </p>
    </div>
  </li>
</template>

<script setup lang="ts">
import { computed, inject, useSlots } from 'vue'
import DateFormat from '../DateFormat.vue'

const props = withDefaults(
  defineProps<{
    info?: string
    title?: string
    content?: string
    time?: string | number | Date
    titleTag?: string
    itemId?: string
  }>(),
  {}
)

const titleTag = computed(() => props.titleTag || inject('timeline:titleTag') || 'h3')
const itemId = computed(() => {
  const prefix = inject('timeline:namespace') || ''
  const id = (props.itemId || props.title || useSlots().title?.()?.toString() || '')
    .trim()
    .replace(/[\s#]+/g, '-')
  return id ? `${prefix}${id}` : undefined
})
const computedTime = computed(() => {
  return props.time ? new Date(props.time) : undefined
})
</script>

<style lang="scss"></style>
