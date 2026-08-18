<template>
  <code class="color-preview">
    <span class="color-block" :style="{ backgroundColor: color }" />
    <span class="color-code">{{ color }}</span>
  </code>
</template>

<script setup lang="ts">
const { color } = defineProps<{
  color: string
}>()
</script>

<style lang="scss">
.color-preview {
  .color-block {
    display: inline-block;
    width: 1em;
    height: 1em;
    vertical-align: middle;
    margin-right: 0.25em;
    border-radius: 50%;
  }

  .color-code {
    font-size: 0.875em;
    font-weight: 400;
  }
}
</style>
