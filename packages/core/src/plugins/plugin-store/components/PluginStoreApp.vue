<template lang="pug">
#ipe-plugin-store-app
  PluginInstallManager
  .theme-ipe-prose: hr(style='margin: 1.5rem 0')
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
</style>
