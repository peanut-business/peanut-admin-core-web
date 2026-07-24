import { describe, expect, it, vi } from 'vitest'
import { createOpsConsoleRuntime } from '../src/runtime'
import type { OpsConsoleTransport } from '../src/contracts'
import { envelope, maintenanceData, result, statusData, taskData } from './fixtures'

const transport = (overrides: Partial<OpsConsoleTransport> = {}): OpsConsoleTransport => ({
  overview: async () => result(200, envelope(statusData)), maintenance: async () => result(200, envelope(maintenanceData)),
  submitBackup: async () => result(202, envelope(taskData)), submitRestore: async () => result(202, envelope({ ...taskData, task_type: 'ops.restore.verify' })),
  task: async () => result(200, envelope(taskData)), scheduleMaintenance: async () => result(200, envelope(maintenanceData)),
  closeMaintenance: async () => result(200, envelope({ ...maintenanceData, state: 'closed', revision: 2 })),
  logs: async () => result(200, envelope({ items: [], next_cursor: null })), ...overrides,
})
const runtime = (api: OpsConsoleTransport, permissions = true) => createOpsConsoleRuntime({
  transport: api, providers: [{ key: 'reference.mysql', backup: true, restoreTargets: ['verification'] }, { key: 'unsafe', backup: true, restoreTargets: ['production'] }],
  maintenanceReasons: ['upgrade'], logSources: ['application'], canRead: () => permissions, canBackup: () => permissions,
  canRestore: () => permissions, canMaintain: () => permissions, canReadLogs: () => permissions, idempotencyKey: () => 'fixed-request-0001',
})

describe('ops-console runtime', () => {
  it('fails closed before transport access when platform read permission is absent', async () => {
    const overview = vi.fn(); const instance = runtime(transport({ overview }), false)
    await instance.load(); expect(overview).not.toHaveBeenCalled(); expect(instance.state.error).toMatchObject({ code: 'OPS_PERMISSION_DENIED', status: 403 })
  })

  it('discards stale responses and aborts active requests on dispose', async () => {
    let resolve!: (value: ReturnType<typeof result>) => void; const observed: AbortSignal[] = []
    const pending = new Promise<ReturnType<typeof result>>(done => { resolve = done })
    const instance = runtime(transport({ overview: async signal => { observed.push(signal); return pending } }))
    const loading = instance.load(); instance.dispose(); expect(observed[0]?.aborted).toBe(true)
    resolve(result(200, envelope(statusData))); await loading; expect(instance.state.overview).toBeNull()
  })

  it('uses only registered provider targets and never renders server detail', async () => {
    const submitRestore = vi.fn(async () => result(503, { code: 'OPS_PROVIDER_UNAVAILABLE', detail: 'password=secret /private/restore.sql', request_id: 'req_ops_2' }))
    const instance = runtime(transport({ submitRestore })); await instance.load()
    expect(instance.providers.map(item => item.key)).toEqual(['reference.mysql'])
    await instance.submitRestore('reference.mysql', 'backup_12345678', 'production'); expect(submitRestore).not.toHaveBeenCalled()
    await instance.submitRestore('reference.mysql', 'backup_12345678', 'verification')
    expect(instance.state.error?.message).toBe('The operation provider is unavailable.'); expect(JSON.stringify(instance.state.error)).not.toContain('password=')
    expect(submitRestore).toHaveBeenCalledWith('reference.mysql', 'backup_12345678', 'verification', 'fixed-request-0001', expect.any(AbortSignal))
  })
})
