<script setup lang="ts">
import { onMounted, ref } from 'vue'

defineProps<{
  enableClickToRefresh?: boolean
}>()

const version = ref('-')

declare global {
  interface Window {
    __NPM_IPE_INFO__?: Promise<{ 'dist-tags': { latest: string } }>
  }
}

const load = async (noCache = false) => {
  if (!window.__NPM_IPE_INFO__ || noCache) {
    window.__NPM_IPE_INFO__ = fetch('https://registry.npmjs.com/@inpageedit/core')
      .then((res) => res.json())
      .catch((e) => {
        window.__NPM_IPE_INFO__ = undefined
      })
  }
  const info = await window.__NPM_IPE_INFO__
  return info
}

onMounted(async () => {
  const info = await load()
  version.value = info['dist-tags'].latest
})
</script>

<template lang="pug">
span.ipe-version(@click='enableClickToRefresh ? load(true) : void 0') {{ version }}
</template>
