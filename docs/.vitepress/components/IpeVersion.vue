<template lang="pug">
span.ipe-version(@click='enableClickToRefresh ? load(true) : void 0', :title='modifiedTime') {{ latest }}
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

defineProps<{
  enableClickToRefresh?: boolean
}>()

const latest = ref('-')
const tags = ref<Record<string, string>>({})
const modifiedTime = ref('')

interface NpmInfo {
  author: {
    name: string
    email: string
    url: string
  }
  description: string
  homepage: string
  license: string
  keywords: string[]
  name: string
  readme: string
  'dist-tags': Record<string, string>
  time: Record<string, string>
}

declare global {
  interface Window {
    __NPM_IPE_INFO__?: Promise<NpmInfo>
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
  const distTags = info['dist-tags']
  tags.value = distTags
  latest.value = distTags.latest
  modifiedTime.value = info.time[distTags.latest]
})
</script>
