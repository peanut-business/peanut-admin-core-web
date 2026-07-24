import { defineAdminModule } from '@peanut-admin/admin-core'
import type { AdminModuleContribution } from '@peanut-admin/admin-core'
import { inject, reactive } from 'vue'
import type { InjectionKey } from 'vue'
import { parseOperationList, parseOperationResponse } from './contracts'
import type { ImportExportOperation, ImportExportStatus, ImportExportTransport, ImportExportTransportResult } from './contracts'

export const IMPORT_EXPORT_MODULE_KEY = 'peanut.import-export' as const
export const IMPORT_EXPORT_ROUTE_NAME = 'peanut.import-export.list' as const
export const IMPORT_EXPORT_ROUTE_PATH = '/app/import-export' as const
export const IMPORT_EXPORT_READ_PERMISSION = 'peanut.import-export.read' as const
export const IMPORT_EXPORT_CREATE_PERMISSION = 'peanut.import-export.create' as const
export const IMPORT_EXPORT_CANCEL_PERMISSION = 'peanut.import-export.cancel' as const
export const IMPORT_EXPORT_STORE_KEY = 'peanut.import-export.runtime' as const

export interface ImportExportError { message: string; requestId: string | null; status: number | null }
export interface ImportExportState {
  items: ImportExportOperation[]; status: ImportExportStatus; page: number; pageSize: number; total: number
  loading: boolean; mutating: boolean; error: ImportExportError | null
}
export interface ImportExportRuntime {
  state: ImportExportState
  canCreate(): boolean
  canCancel(): boolean
  load(): Promise<void>
  setStatus(status: ImportExportStatus): Promise<void>
  submitImport(providerKey: string, fileKey: string, mapping: Record<string, string>): Promise<void>
  submitExport(providerKey: string): Promise<void>
  cancel(operation: ImportExportOperation): Promise<void>
  download(fileKey: string): Promise<void>
  dispose(): void
}
export interface ImportExportRuntimeOptions {
  transport: ImportExportTransport
  canRead(): boolean
  canCreate(): boolean
  canCancel(): boolean
  saveDownload?: (response: Response, fileKey: string) => Promise<void>
  idempotencyKey?: () => string
}

const requestId = (result: ImportExportTransportResult): string | null => {
  const body = typeof result.body === 'object' && result.body !== null && !Array.isArray(result.body) ? result.body as Record<string, unknown> : {}
  const value = body.request_id ?? result.headers.get('X-Request-Id')
  return typeof value === 'string' && value !== '' ? value : null
}
const failure = (result: ImportExportTransportResult): ImportExportError => {
  const body = typeof result.body === 'object' && result.body !== null && !Array.isArray(result.body) ? result.body as Record<string, unknown> : {}
  return { message: typeof body.detail === 'string' && body.detail !== '' ? body.detail : `Import/export request failed (${result.status}).`, requestId: requestId(result), status: result.status }
}
const key = (): string => `web-${crypto.randomUUID()}`
const save = async (response: Response, fileKey: string): Promise<void> => {
  const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement('a')
  anchor.href = url; anchor.download = `${fileKey}.csv`; anchor.click(); URL.revokeObjectURL(url)
}

export const createImportExportRuntime = (options: ImportExportRuntimeOptions): ImportExportRuntime => {
  const state = reactive<ImportExportState>({ items: [], status: 'queued', page: 1, pageSize: 20, total: 0, loading: false, mutating: false, error: null })
  const controllers = new Set<AbortController>(); let generation = 0
  const run = async <T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> => { const controller = new AbortController(); controllers.add(controller); try { return await operation(controller.signal) } finally { controllers.delete(controller) } }
  const load = async (): Promise<void> => {
    const current = ++generation; state.loading = true; state.error = null
    try {
      if (!options.canRead()) throw new Error('IMPORT_EXPORT_PERMISSION_DENIED')
      const result = await run(signal => options.transport.list(state.status, state.page, state.pageSize, signal))
      if (current !== generation) return
      if (result.status !== 200) { state.error = failure(result); return }
      const list = parseOperationList(result.body); state.items = [...list.items]; state.page = list.page; state.pageSize = list.pageSize; state.total = list.total
    } catch (error) { if (current === generation && !(error instanceof DOMException && error.name === 'AbortError')) state.error = { message: 'The import/export service could not be reached.', requestId: null, status: null } }
    finally { if (current === generation) state.loading = false }
  }
  const mutate = async (operation: (signal: AbortSignal) => Promise<ImportExportTransportResult>): Promise<void> => {
    if (state.mutating) return; state.mutating = true; state.error = null
    try { const result = await run(operation); if (result.status !== 201 && result.status !== 200) { state.error = failure(result); return }; parseOperationResponse(result.body); await load() }
    catch { state.error = { message: 'The import/export request could not be completed.', requestId: null, status: null } }
    finally { state.mutating = false }
  }
  return {
    state, canCreate: options.canCreate, canCancel: options.canCancel, load,
    async setStatus(status) { state.status = status; state.page = 1; await load() },
    async submitImport(providerKey, fileKey, mapping) { if (!options.canCreate()) return; await mutate(signal => options.transport.submitImport(providerKey, fileKey, mapping, (options.idempotencyKey ?? key)(), signal)) },
    async submitExport(providerKey) { if (!options.canCreate()) return; await mutate(signal => options.transport.submitExport(providerKey, (options.idempotencyKey ?? key)(), signal)) },
    async cancel(operation) { if (!options.canCancel() || !['queued', 'running'].includes(operation.status)) return; await mutate(signal => options.transport.cancel(operation.operationKey, operation.revision, signal)) },
    async download(fileKey) { state.error = null; try { const response = await run(signal => options.transport.download(fileKey, signal)); if (!response.ok) { let body: unknown = null; try { body = await response.json() } catch { body = null }; state.error = failure({ status: response.status, body, headers: response.headers }); return }; await (options.saveDownload ?? save)(response, fileKey) } catch { state.error = { message: 'The CSV file could not be downloaded.', requestId: null, status: null } } },
    dispose() { generation += 1; for (const controller of controllers) controller.abort(); controllers.clear(); state.items = [] },
  }
}

export const importExportRuntimeKey: InjectionKey<ImportExportRuntime> = Symbol(IMPORT_EXPORT_STORE_KEY)
export const useImportExportRuntime = (): ImportExportRuntime => { const runtime = inject(importExportRuntimeKey); if (runtime === undefined) throw new Error('IMPORT_EXPORT_RUNTIME_MISSING'); return runtime }
export const createImportExportModuleContribution = (runtime: ImportExportRuntime): AdminModuleContribution => defineAdminModule({
  key: IMPORT_EXPORT_MODULE_KEY,
  routes: [{ name: IMPORT_EXPORT_ROUTE_NAME, path: IMPORT_EXPORT_ROUTE_PATH, component: async () => ({ default: (await import('./ImportExportPage.vue')).default }), access: { moduleKey: IMPORT_EXPORT_MODULE_KEY, permissionKeys: [IMPORT_EXPORT_READ_PERMISSION] } }],
  disposeOnTenantChange: true,
  stores: [{ key: IMPORT_EXPORT_STORE_KEY, dispose: runtime.dispose }],
})
