<template>
  <div class="plugin-registry-list">
    <div v-if="loading" class="plugin-registry-loading">Loading plugins from registry...</div>
    <div v-else-if="error" class="plugin-registry-error">
      <p>{{ error }}</p>
      <a :href="registryUrl" target="_blank" rel="noopener noreferrer">
        View registry directly
      </a>
    </div>
    <template v-else>
      <p class="plugin-registry-meta">
        Source:
        <a :href="homepage" target="_blank" rel="noopener noreferrer">{{ name }}</a>
        <span v-if="lastModified"> &middot; Updated: {{ lastModified }}</span>
      </p>
      <div class="plugin-registry-grid">
        <div v-for="pkg in packages" :key="pkg.id" class="plugin-card">
          <div class="plugin-card-header">
            <span class="plugin-name">{{ pkg.name }}</span>
            <code class="plugin-version">{{ pkg.version }}</code>
          </div>
          <p class="plugin-desc">{{ pkg.description || 'No description' }}</p>
          <div class="plugin-meta">
            <span v-if="pkg.author" class="plugin-author">by {{ pkg.author }}</span>
            <span class="plugin-loader">{{ pkg.loader?.kind || 'module' }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

interface RegistryPackage {
  id: string
  name: string
  version: string
  description?: string
  author?: string
  license?: string
  categories?: string[]
  loader?: {
    kind: string
    entry?: string
    styles?: string[]
    main_export?: string
  }
}

interface Registry {
  manifest_version: number
  name: string
  base_url: string
  homepage?: string
  last_modified?: string
  packages: RegistryPackage[]
}

const registryUrl = 'https://registry.ipe.wiki/registry.v1.json'

const loading = ref(true)
const error = ref('')
const name = ref('')
const homepage = ref('')
const lastModified = ref('')
const packages = ref<RegistryPackage[]>([])

onMounted(async () => {
  try {
    const res = await fetch(registryUrl)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data: Registry = await res.json()
    name.value = data.name || 'InPageEdit Plugin Registry'
    homepage.value = data.homepage || registryUrl
    lastModified.value = data.last_modified
      ? new Date(data.last_modified).toLocaleDateString()
      : ''
    packages.value = data.packages || []
  } catch (e: any) {
    error.value = `Failed to load plugin registry: ${e.message}`
  } finally {
    loading.value = false
  }
})
</script>

<style lang="scss">
.plugin-registry-list {
  margin: 1rem 0;
}

.plugin-registry-loading {
  padding: 2rem;
  text-align: center;
  color: var(--vp-c-text-2);
}

.plugin-registry-error {
  padding: 1rem;
  border: 1px solid var(--vp-c-danger-1);
  border-radius: 8px;
  color: var(--vp-c-danger-1);
}

.plugin-registry-meta {
  color: var(--vp-c-text-2);
  font-size: 0.875rem;
  margin-bottom: 1rem;

  a {
    color: var(--vp-c-brand-1);
  }
}

.plugin-registry-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.75rem;
}

.plugin-card {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 1rem;
  transition: border-color 0.25s;

  &:hover {
    border-color: var(--vp-c-brand-1);
  }
}

.plugin-card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.plugin-name {
  font-weight: 600;
  font-size: 1rem;
}

.plugin-version {
  font-size: 0.75rem;
  padding: 0.1em 0.4em;
  background: var(--vp-c-default-soft);
  border-radius: 4px;
}

.plugin-desc {
  color: var(--vp-c-text-2);
  font-size: 0.875rem;
  margin: 0 0 0.5rem;
  line-height: 1.4;
}

.plugin-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--vp-c-text-3);
}

.plugin-loader {
  padding: 0.1em 0.4em;
  background: var(--vp-c-default-soft);
  border-radius: 4px;
}
</style>
