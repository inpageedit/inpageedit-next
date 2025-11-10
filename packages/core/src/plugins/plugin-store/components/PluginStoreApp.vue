<template lang="pug">
#ipe-plugin-store-app
  PluginInstallManager
  .divider-wrapper
    hr.divider
  RegistryManager
</template>

<script setup lang="ts" vapor>
import RegistryManager from './RegistryManager.vue'
import PluginInstallManager from './PluginInstallManager.vue'
</script>

<style scoped lang="scss">
#ipe-plugin-store-app {
  color: var(--ipe-modal-text);
  font-size: 0.875rem;
}

.divider-wrapper {
  margin: 2rem 0;
  .divider {
    border: none;
    height: 1px;
    background: linear-gradient(
      to right,
      transparent,
      color-mix(in srgb, var(--ipe-modal-border-color) 40%, transparent) 10%,
      color-mix(in srgb, var(--ipe-modal-border-color) 60%, transparent) 50%,
      color-mix(in srgb, var(--ipe-modal-border-color) 40%, transparent) 90%,
      transparent
    );
  }
}
</style>
