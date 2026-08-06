<script setup lang="ts">
import { EmptyState } from '@peanut-admin/admin/shell'
import { ElButton } from 'element-plus'
import type { AssetCandidate } from './contracts'

withDefaults(defineProps<{
  items: readonly AssetCandidate[]
  selectedFileKey?: string | null
  loading?: boolean
  error?: string | null
  disabled?: boolean
}>(), {
  selectedFileKey: null,
  loading: false,
  error: null,
  disabled: false,
})

const emit = defineEmits<{
  select: [asset: AssetCandidate]
  retry: []
}>()
</script>

<template>
  <section
    class="asset-selector"
    aria-labelledby="asset-selector-title"
  >
    <header class="asset-selector__header">
      <h2 id="asset-selector-title">
        Media assets
      </h2>
      <ElButton
        :loading="loading"
        :disabled="disabled"
        @click="emit('retry')"
      >
        Reload
      </ElButton>
    </header>
    <div
      v-if="error"
      class="asset-selector__error"
      role="alert"
    >
      <p>{{ error }}</p>
    </div>
    <div
      v-else-if="loading"
      role="status"
      class="asset-selector__status"
    >
      Loading media assets...
    </div>
    <EmptyState
      v-else-if="items.length === 0"
      title="No media assets"
      message="Upload an image before selecting an asset."
    />
    <ul
      v-else
      class="asset-selector__grid"
      aria-label="Available media assets"
    >
      <li
        v-for="asset in items"
        :key="asset.fileKey"
        class="asset-selector__item"
      >
        <button
          type="button"
          class="asset-selector__choice"
          :class="{ 'is-selected': selectedFileKey === asset.fileKey }"
          :aria-pressed="selectedFileKey === asset.fileKey"
          :disabled="disabled"
          @click="emit('select', asset)"
        >
          <img
            v-if="asset.previewUri"
            :src="asset.previewUri"
            :alt="asset.originalName"
            class="asset-selector__preview"
            loading="lazy"
            decoding="async"
            referrerpolicy="no-referrer"
          >
          <span
            v-else
            class="asset-selector__placeholder"
            aria-hidden="true"
          >IMG</span>
          <span class="asset-selector__name">{{ asset.originalName }}</span>
          <span class="asset-selector__meta">{{ asset.width }} x {{ asset.height }}</span>
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.asset-selector { min-width: 0; }
.asset-selector__header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.asset-selector__header h2 { margin: 0; font-size: 16px; letter-spacing: 0; }
.asset-selector__status, .asset-selector__error { padding: 16px 0; }
.asset-selector__error { color: var(--el-color-danger); }
.asset-selector__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(144px, 1fr)); gap: 12px; padding: 0; margin: 0; list-style: none; }
.asset-selector__item { min-width: 0; }
.asset-selector__choice { width: 100%; padding: 8px; border: 1px solid var(--el-border-color); background: var(--el-bg-color); color: inherit; text-align: left; cursor: pointer; }
.asset-selector__choice.is-selected { border-color: var(--el-color-primary); box-shadow: 0 0 0 1px var(--el-color-primary) inset; }
.asset-selector__choice:disabled { cursor: not-allowed; opacity: .65; }
.asset-selector__preview, .asset-selector__placeholder { display: flex; width: 100%; aspect-ratio: 1; object-fit: cover; align-items: center; justify-content: center; background: var(--el-fill-color-light); }
.asset-selector__placeholder { color: var(--el-text-color-secondary); font-size: 13px; }
.asset-selector__name, .asset-selector__meta { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.asset-selector__name { margin-top: 8px; font-weight: 600; }
.asset-selector__meta { margin-top: 2px; color: var(--el-text-color-secondary); font-size: 12px; }
</style>
