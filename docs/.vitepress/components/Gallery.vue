<template>
  <div class="ipe-gallery">
    <a
      v-for="item in items"
      :key="item.src"
      class="gallery-item"
      :style="{ width: size + 'px', height: size + 'px' }"
      :href="item.href === false ? undefined : item.href || item.src"
      :target="item.href === false ? undefined : '_blank'"
      rel="noopener noreferrer"
    >
      <img :src="item.src" loading="lazy" :alt="item.alt" />
    </a>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    items: GalleryItem[]
    size?: number
  }>(),
  {
    size: 150,
  }
)

interface GalleryItem {
  src: string
  alt?: string
  href?: string | false
}
</script>

<style lang="scss">
.ipe-gallery {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;

  .gallery-item {
    background-color: rgba(100, 100, 100, 0.1);
    padding: 1rem;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;

    img {
      object-fit: cover;
      width: 100%;
      height: auto;
      max-width: 100%;
      max-height: 100%;
    }
  }
}
</style>
