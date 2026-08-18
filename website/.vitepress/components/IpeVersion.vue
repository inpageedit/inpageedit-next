<template lang="pug">
span.ipe-version(@click='enableClickToRefresh ? load(true) : void 0', :title='modifiedTime') {{ latest }}
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { fetchNpmPackage } from '../utils/npmFetch'

defineProps<{
  enableClickToRefresh?: boolean
}>()

const latest = ref('-')
const tags = ref<Record<string, string>>({})
const modifiedTime = ref('')

onMounted(async () => {
  const info = await fetchNpmPackage('@inpageedit/core')
  const distTags = info['dist-tags']
  tags.value = distTags
  latest.value = distTags.latest
  modifiedTime.value = info.time[distTags.latest]
})
</script>
