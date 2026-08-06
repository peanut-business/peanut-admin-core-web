<script setup lang="ts">
import { EmptyState, ForbiddenState, ModuleUnavailableState, PageContent, PageHeader, PageToolbar, SessionExpiredState } from '@peanut-admin/admin/shell'
import { ElButton } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import FileAssetSelector from './FileAssetSelector.vue'
import { useFileMediaRuntime } from './runtime'

const runtime = useFileMediaRuntime()
const state = runtime.state
const input = ref<HTMLInputElement | null>(null)
const canCreate = computed(runtime.canCreate)
const canDelete = computed(runtime.canDelete)
const selectedAssetKey = ref<string | null>(null)

const upload = async (event: Event): Promise<void> => {
  const target = event.currentTarget
  if (!(target instanceof HTMLInputElement) || target.files?.length !== 1) return
  const file = target.files.item(0)
  if (file !== null) await runtime.upload(file)
  target.value = ''
}

onMounted(() => Promise.all([runtime.load(), runtime.loadAssets()]))
</script>

<template>
  <PageContent class="file-media-page">
    <PageHeader>
      Files
      <template #actions>
        <input
          ref="input"
          class="file-input"
          type="file"
          aria-label="Choose private file"
          @change="upload"
        >
        <ElButton
          :disabled="!canCreate || state.mutating"
          type="primary"
          @click="input?.click()"
        >
          Upload
        </ElButton>
        <ElButton
          :loading="state.loading"
          :disabled="state.mutating"
          @click="runtime.load"
        >
          Reload
        </ElButton>
      </template>
    </PageHeader>
    <PageToolbar label="File status">
      <ElButton
        :type="state.status === 'ready' ? 'primary' : 'default'"
        @click="runtime.setStatus('ready')"
      >
        Ready
      </ElButton>
      <ElButton
        :type="state.status === 'archived' ? 'primary' : 'default'"
        @click="runtime.setStatus('archived')"
      >
        Archived
      </ElButton>
    </PageToolbar>

    <FileAssetSelector
      :items="state.assets"
      :selected-file-key="selectedAssetKey"
      :loading="state.assetsLoading"
      :error="state.assetsError?.message ?? null"
      :disabled="state.mutating"
      @select="selectedAssetKey = $event.fileKey"
      @retry="runtime.loadAssets"
    />

    <SessionExpiredState
      v-if="state.error?.status === 401"
      :message="state.error.message"
    />
    <ForbiddenState
      v-else-if="state.error?.status === 403"
      :message="state.error.message"
    />
    <ModuleUnavailableState
      v-else-if="state.error?.status === 503"
      :message="state.error.message"
      @action="runtime.load"
    />
    <section
      v-else-if="state.error"
      role="alert"
      class="file-state"
    >
      <h2>Unable to complete the file request</h2>
      <p>{{ state.error.message }}</p>
      <p v-if="state.error.requestId">
        Request ID: {{ state.error.requestId }}
      </p>
    </section>
    <div
      v-else-if="state.loading"
      class="file-state"
      role="status"
    >
      Loading files...
    </div>
    <EmptyState
      v-else-if="state.items.length === 0"
      title="No files"
      message="No private files match this status."
    />
    <div
      v-else
      class="file-table-wrap"
    >
      <table class="file-table">
        <thead><tr><th>Name</th><th>Type</th><th>Size</th><th>Status</th><th>Revision</th><th>Actions</th></tr></thead>
        <tbody>
          <tr
            v-for="file in state.items"
            :key="file.fileKey"
          >
            <td>{{ file.originalName }}</td><td>{{ file.mediaType }}</td><td>{{ file.sizeBytes }}</td>
            <td>{{ file.status }}</td><td>{{ file.revision }}</td>
            <td>
              <ElButton
                v-if="file.status === 'ready'"
                text
                @click="runtime.download(file)"
              >
                Download
              </ElButton>
              <ElButton
                v-if="file.status === 'ready'"
                text
                :disabled="!canDelete || state.mutating"
                @click="runtime.archive(file)"
              >
                Archive
              </ElButton>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </PageContent>
</template>

<style scoped>
.file-input { display: none; }
.file-state { padding: 24px 0; }
.file-table-wrap { overflow-x: auto; }
.file-table { width: 100%; border-collapse: collapse; }
.file-table th, .file-table td { padding: 10px 8px; border-bottom: 1px solid var(--el-border-color); text-align: left; }
</style>
