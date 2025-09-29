<template lang="pug">
.ipe-mbox(ref='elRef', :class='[`mbox-type-${type || "default"}`, "theme-ipe"]')
  .title
    slot(name='title') {{ computedTitle }}
  .content
    slot(name='content')
      slot(name='default')
        | {{ content }}
  a.close(v-if='closeable', @click.prevent='close()') ×
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'

export type MBoxType =
  | ''
  | 'default'
  | 'note'
  | 'info'
  | 'tip'
  | 'success'
  | 'important'
  | 'done'
  | 'warning'
  | 'caution'
  | 'error'

export interface MBoxProps {
  type?: MBoxType
  title?: string
  content?: string
  closeable?: boolean
}

const { type = 'default', title, content, closeable = false } = defineProps<MBoxProps>()

defineExpose({ close })

const computedTitle = computed(() => {
  return title || (type ? type.charAt(0).toUpperCase() + type.slice(1) : '')
})

const elRef = useTemplateRef('elRef')

function close() {
  const el = elRef.value
  if (!el) return Promise.resolve()

  return new Promise<void>((resolve) => {
    const h = el.clientHeight
    const animation = el.animate(
      [
        { opacity: '1', height: h + 'px' },
        { opacity: '0', height: '0px', margin: '0px' },
      ],
      { duration: 300, easing: 'ease' }
    )
    animation.addEventListener('finish', () => {
      el.remove()
      resolve()
    })
  })
}
</script>

<style scoped lang="sass">
.ipe-mbox
  --border-color: #dfdfdf
  --title-color: #efefef
  --content-color: #ffffff
  border-radius: 0.5rem
  border: 1px solid var(--title-color)
  border-left: 6px solid var(--border-color)
  overflow: hidden
  margin: 1rem 0
  position: relative
  display: block
  font-family: inherit

  .title
    background-color: var(--title-color)
    padding: 0.5rem 1rem
    font-weight: 700
    font-size: 1rem
    line-height: 1.2
  .content
    background-color: var(--content-color)
    padding: 0.5rem 1rem
    font-size: 1rem
    line-height: 1.5
    max-height: 14em
    overflow: auto
  .close
    position: absolute
    top: 0.5rem
    right: 0.5rem
    font-size: 1.25rem
    line-height: 1rem
    color: var(--border-color)
    cursor: pointer
    user-select: none
    text-decoration: none
    &:hover
      filter: brightness(1.2)
    &:active
      filter: brightness(0.8)

  // Types
  &.mbox-type-note,
  &.mbox-type-info
    --border-color: #1f6feb
    --title-color: #AFD1FE
    --content-color: #f3f9ff

  &.mbox-type-tip,
  &.mbox-type-success
    --border-color: #238636
    --title-color: #E0F1E3
    --content-color: #f9f9f9

  &.mbox-type-important,
  &.mbox-type-done
    --border-color: #8957e5
    --title-color: #DDCBFC
    --content-color: #f9f9f9

  &.mbox-type-warning
    --border-color: #9e6a03
    --title-color: #E4CC9D
    --content-color: #fff9db

  &.mbox-type-caution,
  &.mbox-type-error
    --border-color: #da3633
    --title-color: #FCB9B6
    --content-color: #f9f9f9
</style>
