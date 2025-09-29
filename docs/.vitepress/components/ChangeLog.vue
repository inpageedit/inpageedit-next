<template>
  <TimelineItem :item-id="version" :time="computedTime" :info="computedInfo">
    <template #default>
      <slot name="default">
        <ul>
          <li>修复已知问题，优化使用体验~</li>
        </ul>
      </slot>
      <p
        v-if="currentVersionInfo"
        :style="{ display: 'flex', gap: '1em', flexWrap: 'wrap', fontSize: '0.9em' }"
      >
        <a
          :href="`https://www.npmjs.com/package/@inpageedit/core/v/${version}`"
          target="_blank"
          rel="noopener noreferrer"
        >
          View on NPM
        </a>
        <a
          v-if="prevVersionInfo"
          :href="`https://github.com/inpageedit/inpageedit-next/compare/${prevVersionInfo.version}...${version}`"
          target="_blank"
          rel="noopener noreferrer"
        >
          Git Diff
        </a>
        <a
          :href="`https://github.com/inpageedit/inpageedit-next/issues/new?template=bug_report.md&ipe_version=${version}`"
          target="_blank"
          rel="noopener noreferrer"
        >
          Bug Report
        </a>
      </p>
    </template>
    <template #title>
      <slot name="title">
        {{ title || version }}
      </slot>
    </template>
  </TimelineItem>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import TimelineItem from './Timeline/TimelineItem.vue'
import { getNpmRegistryPackage, type NpmRegistryPackage } from '../utils/getNpmRegistry'

const props = defineProps<{
  version: string
  info?: string
  title?: string
  time?: string
}>()

const npm = ref<NpmRegistryPackage | null>(null)
const load = async () => {
  npm.value = await getNpmRegistryPackage('@inpageedit/core')
}

const currentVersionInfo = computed(() => {
  const i = npm.value?.versions?.[props.version] || null
  return i
    ? {
        ...i,
        time: npm.value?.time?.[props.version] || undefined,
      }
    : null
})
const prevVersionInfo = computed(() => {
  if (!currentVersionInfo.value) return null
  const versions = Object.keys(npm.value?.versions || {}).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  )
  const index = versions.indexOf(props.version)
  if (index > 0) {
    const v = versions[index - 1]
    const i = npm.value?.versions?.[v] || null
    return i
      ? {
          ...i,
          time: npm.value?.time?.[v] || undefined,
        }
      : null
  }
  return null
})
const computedTime = computed(() => {
  return props.time || currentVersionInfo.value?.time || undefined
})
const computedInfo = computed(() => {
  if (props.info !== undefined) return props.info
  if (npm.value === null) return 'Loading...'
  return computedTime.value ? undefined : 'Coming Soon'
})

onMounted(load)
</script>

<style scoped lang="sass"></style>
