import { describe, expect, it } from 'vitest'
import { createImportExportRuntime } from '../src/runtime'
import type { ImportExportTransport, ImportExportTransportResult } from '../src/contracts'

const result = (status: number, body: unknown): ImportExportTransportResult => ({ status, body, headers: new Headers({ 'X-Request-Id': 'req-1' }) })
const operation = { operation_key: `iox_${'a'.repeat(32)}`, provider_key: 'test.contacts', direction: 'export', format: 'csv', status: 'queued', input_file_key: null, result_file_key: null, error_file_key: null, task_job_key: `job_${'d'.repeat(32)}`, schema_revision: 'contacts.v1', mapping: {}, processed_rows: 0, accepted_rows: 0, rejected_rows: 0, total_rows: 0, revision: 2, last_error_code: null, retention_until: '2026-08-01T00:00:00.000Z', created_at: '2026-07-24T00:00:00.000Z', updated_at: '2026-07-24T00:00:00.000Z', completed_at: null }

describe('import/export runtime', () => {
  it('loads, submits, cancels and disposes tenant-scoped state', async () => {
    const calls: string[] = []
    const transport: ImportExportTransport = {
      async list() { calls.push('list'); return result(200, { data: { items: [operation] }, meta: { request_id: 'req-1', page: 1, page_size: 20, total: 1 } }) },
      async submitImport() { calls.push('import'); return result(201, { data: operation, meta: {} }) },
      async submitExport() { calls.push('export'); return result(201, { data: operation, meta: {} }) },
      async cancel() { calls.push('cancel'); return result(200, { data: { ...operation, status: 'cancelled', revision: 3, completed_at: '2026-07-24T00:00:01.000Z' }, meta: {} }) },
      async download() { return new Response('csv') },
    }
    const runtime = createImportExportRuntime({ transport, canRead: () => true, canCreate: () => true, canCancel: () => true, idempotencyKey: () => 'web-test-key' })
    await runtime.load(); await runtime.submitExport('test.contacts'); await runtime.cancel(runtime.state.items[0]!)
    expect(calls).toEqual(['list', 'export', 'list', 'cancel', 'list']); runtime.dispose(); expect(runtime.state.items).toEqual([])
  })
  it('fails closed before transport when create permission is absent', async () => {
    let called = false
    const transport = { list: async () => result(200, { data: { items: [] }, meta: { request_id: 'r', page: 1, page_size: 20, total: 0 } }), submitImport: async () => { called = true; return result(500, {}) }, submitExport: async () => { called = true; return result(500, {}) }, cancel: async () => result(500, {}), download: async () => new Response() } satisfies ImportExportTransport
    const runtime = createImportExportRuntime({ transport, canRead: () => true, canCreate: () => false, canCancel: () => false })
    await runtime.submitExport('test.contacts'); expect(called).toBe(false)
  })
})
