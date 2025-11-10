<template lang="pug">
button.ipeps-button(:class='buttonClass')
  slot
</template>

<script setup lang="ts" vapor>
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    variant?: 'neutral' | 'primary' | 'danger' | 'ghost' | 'accent'
    active?: boolean
  }>(),
  {
    variant: 'neutral',
    active: false,
  }
)

const buttonClass = computed(() => ({
  'is-active': props.active,
  'is-danger': props.variant === 'danger',
  'is-primary': props.variant === 'primary',
  'is-ghost': props.variant === 'ghost',
  'is-accent': props.variant === 'accent',
}))
</script>
