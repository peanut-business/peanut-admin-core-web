import { defineAdminModule } from '@peanut-admin/admin/core'
import { inject, reactive } from 'vue'
import type { AdminModuleContribution } from '@peanut-admin/admin/core'
import type { InjectionKey } from 'vue'

import { parseAssetList, parseFileList, parseFileResponse } from './contracts'
import type { AssetCandidate, FileMediaTransport, FileObject, FileStatus, FileTransportResult } from './contracts'

export const FILE_MEDIA_MODULE_KEY = 'peanut.file-media' as const
export const FILE_MEDIA_ROUTE_NAME = 'peanut.file-media.list' as const
export const FILE_MEDIA_ROUTE_PATH = '/app/files' as const
export const FILE_MEDIA_READ_PERMISSION = 'peanut.file-media.read' as const
export const FILE_MEDIA_CREATE_PERMISSION = 'peanut.file-media.create' as const
export const FILE_MEDIA_DELETE_PERMISSION = 'peanut.file-media.delete' as const
export const FILE_MEDIA_STORE_KEY = 'peanut.file-media.runtime' as const

export interface FileMediaError {
  readonly message: string
  readonly requestId: string | null
  readonly status: number | null
}

export interface FileMediaState {
  items: FileObject[]
  status: FileStatus
  page: number
  pageSize: number
  total: number
  assets: AssetCandidate[]
  assetsLoading: boolean
  assetsError: FileMediaError | null
  loading: boolean
  mutating: boolean
  error: FileMediaError | null
}

export interface FileMediaRuntime {
  readonly state: FileMediaState
  readonly canCreate: () => boolean
  readonly canDelete: () => boolean
  load: () => Promise<void>
  loadAssets: () => Promise<void>
  setStatus: (status: FileStatus) => Promise<void>
  upload: (file: File) => Promise<void>
  download: (file: FileObject) => Promise<void>
  archive: (file: FileObject) => Promise<void>
  dispose: () => void
}

export interface FileMediaRuntimeOptions {
  readonly transport: FileMediaTransport
  readonly canRead: () => boolean
  readonly canCreate: () => boolean
  readonly canDelete: () => boolean
  readonly saveDownload?: (response: Response, file: FileObject) => Promise<void>
}

const requestId = (result: FileTransportResult): string | null => {
  const body = typeof result.body === 'object' && result.body !== null && !Array.isArray(result.body)
    ? result.body as Record<string, unknown>
    : {}
  const value = body.request_id ?? result.headers.get('X-Request-Id')
  return typeof value === 'string' && value !== '' ? value : null
}

const failure = (result: FileTransportResult): FileMediaError => {
  const body = typeof result.body === 'object' && result.body !== null && !Array.isArray(result.body)
    ? result.body as Record<string, unknown>
    : {}
  return {
    message: typeof body.detail === 'string' && body.detail !== '' ? body.detail : `File request failed (${result.status}).`,
    requestId: requestId(result),
    status: result.status,
  }
}

const defaultSave = async (response: Response, file: FileObject): Promise<void> => {
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = file.originalName
  anchor.click()
  URL.revokeObjectURL(url)
}

export const createFileMediaRuntime = (options: FileMediaRuntimeOptions): FileMediaRuntime => {
  const state = reactive<FileMediaState>({
    items: [], status: 'ready', page: 1, pageSize: 20, total: 0,
    assets: [], assetsLoading: false, assetsError: null,
    loading: false, mutating: false, error: null,
  })
  const controllers = new Set<AbortController>()
  let generation = 0
  const run = async <T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> => {
    const controller = new AbortController()
    controllers.add(controller)
    try { return await operation(controller.signal) } finally { controllers.delete(controller) }
  }

  const load = async (): Promise<void> => {
    const current = ++generation
    state.loading = true
    state.error = null
    try {
      if (!options.canRead()) throw new Error('FILE_MEDIA_PERMISSION_DENIED')
      const result = await run(signal => options.transport.list(state.status, state.page, state.pageSize, signal))
      if (current !== generation) return
      if (result.status !== 200) { state.error = failure(result); return }
      const list = parseFileList(result.body)
      state.items = [...list.items]
      state.page = list.page
      state.pageSize = list.pageSize
      state.total = list.total
    } catch (error) {
      if (current === generation && !(error instanceof DOMException && error.name === 'AbortError')) {
        state.error = { message: 'The file service could not be reached.', requestId: null, status: null }
      }
    } finally {
      if (current === generation) state.loading = false
    }
  }

  const loadAssets = async (): Promise<void> => {
    const current = generation
    state.assetsLoading = true
    state.assetsError = null
    try {
      if (!options.canRead()) throw new Error('FILE_MEDIA_PERMISSION_DENIED')
      const result = await run(signal => options.transport.assets(1, 50, signal))
      if (current !== generation) return
      if (result.status !== 200) { state.assetsError = failure(result); return }
      state.assets = [...parseAssetList(result.body).items]
    } catch (error) {
      if (current === generation && !(error instanceof DOMException && error.name === 'AbortError')) {
        state.assetsError = { message: 'The media asset service could not be reached.', requestId: null, status: null }
      }
    } finally {
      if (current === generation) state.assetsLoading = false
    }
  }

  return {
    state,
    canCreate: options.canCreate,
    canDelete: options.canDelete,
    load,
    loadAssets,
    async setStatus(status) { state.status = status; state.page = 1; await load() },
    async upload(file) {
      if (!options.canCreate() || state.mutating) return
      state.mutating = true
      state.error = null
      try {
        const result = await run(signal => options.transport.upload(file, signal))
        if (result.status !== 201) { state.error = failure(result); return }
        parseFileResponse(result.body)
        state.status = 'ready'
        await Promise.all([load(), loadAssets()])
      } catch { state.error = { message: 'The upload could not be completed.', requestId: null, status: null } }
      finally { state.mutating = false }
    },
    async download(file) {
      state.error = null
      try {
        const response = await run(signal => options.transport.download(file.fileKey, signal))
        if (!response.ok) {
          let body: unknown = null
          try { body = await response.json() } catch { body = null }
          state.error = failure({ body, headers: response.headers, status: response.status })
          return
        }
        await (options.saveDownload ?? defaultSave)(response, file)
      } catch { state.error = { message: 'The download could not be completed.', requestId: null, status: null } }
    },
    async archive(file) {
      if (!options.canDelete() || state.mutating) return
      state.mutating = true
      state.error = null
      try {
        const result = await run(signal => options.transport.archive(file.fileKey, `"rev-${file.revision}"`, signal))
        if (result.status !== 200) { state.error = failure(result); return }
        parseFileResponse(result.body)
        await load()
      } catch { state.error = { message: 'The file could not be archived.', requestId: null, status: null } }
      finally { state.mutating = false }
    },
    dispose() { generation += 1; for (const controller of controllers) controller.abort(); controllers.clear(); state.assets = [] },
  }
}

export const fileMediaRuntimeKey: InjectionKey<FileMediaRuntime> = Symbol(FILE_MEDIA_STORE_KEY)

export const useFileMediaRuntime = (): FileMediaRuntime => {
  const runtime = inject(fileMediaRuntimeKey)
  if (runtime === undefined) throw new Error('FILE_MEDIA_RUNTIME_MISSING')
  return runtime
}

export const createFileMediaModuleContribution = (runtime: FileMediaRuntime): AdminModuleContribution => defineAdminModule({
  key: FILE_MEDIA_MODULE_KEY,
  routes: [{
    name: FILE_MEDIA_ROUTE_NAME,
    path: FILE_MEDIA_ROUTE_PATH,
    component: async () => ({ default: (await import('./FileMediaPage.vue')).default }),
    access: { moduleKey: FILE_MEDIA_MODULE_KEY, permissionKeys: [FILE_MEDIA_READ_PERMISSION] },
  }],
  disposeOnTenantChange: true,
  stores: [{ key: FILE_MEDIA_STORE_KEY, dispose: runtime.dispose }],
})
