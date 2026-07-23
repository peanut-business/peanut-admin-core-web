// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, provide } from 'vue'
import FileMediaPage from '../src/FileMediaPage.vue'
import { createFileMediaRuntime, fileMediaRuntimeKey } from '../src/runtime'
import type { FileMediaTransport, FileTransportResult } from '../src/contracts'

const item = {
  file_key: 'file_0123456789abcdef0123456789abcdef', original_name: 'report.txt', media_type: 'text/plain',
  size_bytes: 12, sha256: 'a'.repeat(64), status: 'ready', revision: 1,
  created_at: '2026-07-23T00:00:00.000Z', updated_at: '2026-07-23T00:00:00.000Z', archived_at: null,
}
const result = (status: number, body: unknown): FileTransportResult => ({ status, body, headers: new Headers() })

describe('file-media page', () => {
  it('loads metadata and exposes guarded actions', async () => {
    const transport: FileMediaTransport = {
      list: vi.fn(async () => result(200, { data: { items: [item] }, meta: { request_id: 'req', page: 1, page_size: 20, total: 1 } })),
      assets: vi.fn(async () => result(200, { data: { items: [] }, meta: { request_id: 'req', page: 1, page_size: 20, total: 0 } })),
      upload: vi.fn(), download: vi.fn(), archive: vi.fn(),
    }
    const runtime = createFileMediaRuntime({ transport, canRead: () => true, canCreate: () => true, canDelete: () => false })
    const host = defineComponent({ setup() { provide(fileMediaRuntimeKey, runtime); return () => h(FileMediaPage) } })
    const wrapper = mount(host, { global: { stubs: { PageContent: { template: '<main><slot /></main>' }, PageHeader: { template: '<header><slot /><slot name="actions" /></header>' }, PageToolbar: { template: '<nav><slot /></nav>' }, EmptyState: true, ForbiddenState: true, ModuleUnavailableState: true, SessionExpiredState: true, ElButton: { props: ['disabled'], template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>' } } } })
    await vi.waitFor(() => expect(wrapper.text()).toContain('report.txt'))
    const archiveButton = wrapper.findAll('button').find(button => button.text() === 'Archive')
    expect(archiveButton?.attributes('disabled')).toBeDefined()
  })

  it('archives with a strong current revision and reloads', async () => {
    const archive = vi.fn(async () => result(200, { data: { ...item, status: 'archived', revision: 2, archived_at: '2026-07-23T00:01:00.000Z' }, meta: { request_id: 'req' } }))
    const list = vi.fn(async () => result(200, { data: { items: [item] }, meta: { request_id: 'req', page: 1, page_size: 20, total: 1 } }))
    const runtime = createFileMediaRuntime({
      transport: {
        list,
        assets: vi.fn(async () => result(200, { data: { items: [] }, meta: { request_id: 'req', page: 1, page_size: 20, total: 0 } })),
        archive,
        upload: vi.fn(),
        download: vi.fn(),
      },
      canRead: () => true, canCreate: () => true, canDelete: () => true,
    })
    await runtime.load()
    await runtime.archive(runtime.state.items[0]!)
    expect(archive).toHaveBeenCalledWith(item.file_key, '"rev-1"', expect.any(AbortSignal))
    expect(list).toHaveBeenCalledTimes(2)
  })
})
