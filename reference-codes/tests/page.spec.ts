// @vitest-environment happy-dom

import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import ReferenceCodesPage from '../src/ReferenceCodesPage.vue'
import {
  createReferenceCodesModuleContribution,
  createReferenceCodesRuntime,
  REFERENCE_CODES_MODULE_KEY,
  REFERENCE_CODES_READ_PERMISSION,
  referenceCodesRuntimeKey,
} from '../src/runtime'
import type { ReferenceCodesTransport, ReferenceCodesTransportResult } from '../src/contracts'

const setSummary = {
  module_key: 'example.catalog',
  set_key: 'service-level',
  name: 'Service level',
  description: 'Generic service levels.',
  definition_revision: 1,
}

const entry = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  module_key: 'example.catalog',
  set_key: 'service-level',
  code: 'standard',
  lifecycle: 'active',
  revision: 2,
  etag: '"rev-2"',
  effective: {
    revision: 2,
    label: 'Standard',
    metadata: {},
    status: 'active',
    sort_order: 10,
    effective_at: '2026-07-20T00:00:00.000Z',
    expires_at: null,
  },
  created_at: '2026-07-20T00:00:00.000Z',
  updated_at: '2026-07-20T01:00:00.000Z',
  retired_at: null,
  ...overrides,
})

const result = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): ReferenceCodesTransportResult => ({ body, status, headers: new Headers(headers) })

const listResult = (...items: Record<string, unknown>[]): ReferenceCodesTransportResult => result({
  data: {
    items,
    as_of: '2026-07-20T02:00:00.000Z',
    page: 1,
    page_size: 50,
    total: items.length,
  },
})

const createTransport = (): ReferenceCodesTransport => ({
  listSets: vi.fn(async () => result({ data: { items: [setSummary] } })),
  listCodes: vi.fn(async () => listResult(entry())),
  getCode: vi.fn(async () => result({ data: entry({ revision: 3, etag: '"rev-3"' }) }, 200, { ETag: '"rev-3"' })),
  create: vi.fn(async () => result({ data: entry({ code: 'priority', revision: 1, etag: '"rev-1"' }) }, 201, { ETag: '"rev-1"' })),
  replace: vi.fn(async () => result({ data: entry({ revision: 3, etag: '"rev-3"' }) }, 200, { ETag: '"rev-3"' })),
  retire: vi.fn(async () => result({ data: entry({ lifecycle: 'retired', revision: 3, etag: '"rev-3"', retired_at: '2026-07-20T02:00:00.000Z' }) }, 200, { ETag: '"rev-3"' })),
})

describe('reference-code Tenant page', () => {
  it('exports one Tenant-only read-guarded contribution and fails closed before reads', async () => {
    const transport = createTransport()
    const runtime = createReferenceCodesRuntime({
      transport,
      canRead: () => false,
      canManage: () => false,
      now: () => '2026-07-20T02:00:00.000Z',
    })
    const contribution = createReferenceCodesModuleContribution(runtime)

    await expect(runtime.loadSets()).rejects.toThrow('REFERENCE_CODES_READ_FORBIDDEN')
    expect(transport.listSets).not.toHaveBeenCalled()
    expect(contribution.key).toBe(REFERENCE_CODES_MODULE_KEY)
    expect(contribution.routes).toHaveLength(1)
    expect(contribution.routes[0]).toMatchObject({
      path: '/app/reference-codes',
      access: { moduleKey: REFERENCE_CODES_MODULE_KEY, permissionKeys: [REFERENCE_CODES_READ_PERMISSION] },
    })
    expect(contribution.routes.some(route => route.path.startsWith('/platform/'))).toBe(false)

    const invalidSuccessTransport = createTransport()
    vi.mocked(invalidSuccessTransport.listSets).mockResolvedValueOnce(result({ data: { items: [setSummary] } }, 201))
    const invalidSuccessRuntime = createReferenceCodesRuntime({
      transport: invalidSuccessTransport,
      canRead: () => true,
      canManage: () => true,
      now: () => '2026-07-20T02:00:00.000Z',
    })
    await invalidSuccessRuntime.loadSets()
    expect(invalidSuccessRuntime.state.errors.page).toMatchObject({ kind: 'protocol', status: 201 })
  })

  it('drives owner/set, as-of, create, append-version, and retire operations', async () => {
    const transport = createTransport()
    const runtime = createReferenceCodesRuntime({
      transport,
      canRead: () => true,
      canManage: () => true,
      createIdempotencyKey: () => 'idem_reference_codes_0001',
      now: () => '2026-07-20T02:00:00.000Z',
    })
    const wrapper = mount(ReferenceCodesPage, {
      global: { provide: { [referenceCodesRuntimeKey as symbol]: runtime } },
    })
    await flushPromises()

    await runtime.selectSet('example.catalog', 'service-level')
    runtime.beginCreate()
    runtime.beginRetire(runtime.state.entries.find(candidate => candidate.code === 'standard')!)
    expect(runtime.state.createDraft).toBeNull()
    expect(runtime.state.retireCode).toBe('standard')
    runtime.cancelRetire()
    runtime.beginCreate()
    runtime.updateCreateDraft({
      code: 'priority', label: 'Priority', metadataText: '{"rank":1}', status: 'active', sortOrder: 5,
      effectiveAt: '2026-07-21T00:00:00.000Z', expiresAt: null,
    })
    await runtime.create()
    runtime.beginAppend(runtime.state.entries.find(candidate => candidate.code === 'standard')!)
    runtime.updateAppendDraft({ label: 'Standard v3' })
    await runtime.appendVersion()
    runtime.beginRetire(runtime.state.entries.find(candidate => candidate.code === 'standard')!)
    await runtime.retire()

    expect(transport.listCodes).toHaveBeenCalledWith('example.catalog', 'service-level', expect.objectContaining({
      asOf: '2026-07-20T02:00:00.000Z', page: 1, pageSize: 50,
    }), expect.any(AbortSignal))
    expect(transport.create).toHaveBeenCalledWith('example.catalog', 'service-level', expect.objectContaining({
      input: expect.objectContaining({ code: 'priority', metadata: { rank: 1 } }),
    }))
    expect(transport.replace).toHaveBeenCalledWith('example.catalog', 'service-level', 'standard', expect.objectContaining({
      etag: '"rev-2"', input: expect.not.objectContaining({ code: expect.anything() }),
    }))
    expect(transport.retire).toHaveBeenCalledWith('example.catalog', 'service-level', 'standard', expect.objectContaining({
      etag: '"rev-3"',
    }))
    expect(wrapper.text()).toContain('Reference codes')
  })

  it('keeps append input on 412 and reloads the stale identity explicitly', async () => {
    const transport = createTransport()
    vi.mocked(transport.create).mockResolvedValueOnce(result({
      type: '/docs/problems/precondition-failed',
      title: 'Precondition failed',
      status: 412,
      detail: 'The reference code already exists.',
      code: 'REFERENCE_CODE_ALREADY_EXISTS',
      request_id: 'req_existing_code',
    }, 412))
    vi.mocked(transport.replace).mockResolvedValueOnce(result({
      type: '/docs/problems/precondition-failed',
      title: 'Precondition failed',
      status: 412,
      detail: 'The reference code changed.',
      code: 'REFERENCE_CODE_REVISION_MISMATCH',
      request_id: 'req_stale_code',
    }, 412))
    const runtime = createReferenceCodesRuntime({
      transport,
      canRead: () => true,
      canManage: () => true,
      now: () => '2026-07-20T02:00:00.000Z',
    })
    await runtime.loadSets()
    await runtime.selectSet('example.catalog', 'service-level')
    runtime.beginCreate()
    runtime.updateCreateDraft({ code: 'existing-code', label: 'Unsaved create input' })
    await runtime.create()
    const wrapper = mount(ReferenceCodesPage, {
      global: { provide: { [referenceCodesRuntimeKey as symbol]: runtime } },
    })
    await flushPromises()

    expect(runtime.state.createDraft?.label).toBe('Unsaved create input')
    expect(wrapper.text()).toContain('The reference code already exists.')
    expect(wrapper.get('[data-reference-create-reload]').text()).toContain('Reload entries')
    runtime.cancelCreate()
    runtime.beginAppend(runtime.state.entries[0]!)
    runtime.updateAppendDraft({ label: 'Unsaved operator input' })

    await runtime.appendVersion()

    expect(runtime.state.appendDraft?.label).toBe('Unsaved operator input')
    expect(runtime.state.stale.standard?.requestId).toBe('req_stale_code')
    expect(transport.getCode).not.toHaveBeenCalled()

    await runtime.reloadStale('standard')

    expect(transport.getCode).toHaveBeenCalledWith(
      'example.catalog', 'service-level', 'standard', '2026-07-20T02:00:00.000Z', expect.any(AbortSignal),
    )
    expect(runtime.state.appendDraft).toMatchObject({ label: 'Unsaved operator input', etag: '"rev-3"' })
    expect(runtime.state.stale.standard).toBeUndefined()
    wrapper.unmount()
  })

  it('aborts requests and clears every Tenant-owned view state on disposal', async () => {
    let listSignal: AbortSignal | undefined
    const transport = createTransport()
    vi.mocked(transport.listCodes).mockImplementationOnce(async (_moduleKey, _setKey, _query, signal) => {
      listSignal = signal
      return new Promise<ReferenceCodesTransportResult>(() => undefined)
    })
    const runtime = createReferenceCodesRuntime({
      transport,
      canRead: () => true,
      canManage: () => true,
      now: () => '2026-07-20T02:00:00.000Z',
    })
    await runtime.loadSets()
    const pending = runtime.selectSet('example.catalog', 'service-level')
    runtime.beginCreate()
    runtime.updateCreateDraft({ code: 'draft-code', label: 'Draft label' })
    runtime.state.errors.page = { kind: 'transport', message: 'old error', requestId: null, status: null }

    runtime.dispose()

    expect(listSignal?.aborted).toBe(true)
    expect(runtime.state).toMatchObject({
      sets: [], selectedSet: null, asOf: '', entries: [], page: 1, pageSize: 50, total: 0,
      createDraft: null, appendDraft: null, retireCode: null, errors: {}, stale: {}, loading: false,
    })
    expect(runtime.state.requests.size).toBe(0)
    await expect(Promise.race([pending, Promise.resolve()])).resolves.toBeUndefined()
  })
})
