<template>
  <TimelineItem :title-tag="titleTag" class="period">
    <template #title>
      <slot>{{ title }}</slot>
    </template>
  </TimelineItem>
</template>

<script setup lang="ts">
import TimelineItem from './TimelineItem.vue'

defineProps<{
  title?: string
  titleTag?: string
}>()
</script>

<style lang="scss"></style>
