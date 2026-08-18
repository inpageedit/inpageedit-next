<template>
  <li class="timeline-item" :data-item-id="itemId">
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
      <component class="timeline-title" :is="titleTag" :id="itemId || title" ref="titleRef">
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
import { computed, inject, useSlots, useTemplateRef } from 'vue'
import DateFormat from '../DateFormat.vue'

const props = withDefaults(
  defineProps<{
    info?: string
    title?: string
    content?: string
    time?: string | number | Date
    titleTag?: string
    titleId?: string // @deprecated use itemId
    itemId?: string
  }>(),
  {}
)

const titleRef = useTemplateRef<HTMLHeadingElement>('titleRef')

const titleTag = computed(() => props.titleTag || inject('timeline:titleTag') || 'h3')
const itemId = computed(() => {
  const prefix = inject('timeline:namespace') || ''
  const id = (
    props.itemId ||
    props.titleId ||
    props.title ||
    (titleRef.value?.innerText as string) ||
    ''
  )
    .trim()
    .replace(/[\s#]+/g, '-')
  return id ? `${prefix}${id}` : undefined
})
const computedTime = computed(() => {
  return props.time ? new Date(props.time) : undefined
})
</script>

<style lang="scss"></style>
