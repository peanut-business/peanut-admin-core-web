import { describe, expect, it, vi } from 'vitest'
import { createIntegrationSecurityRuntime } from '../src/runtime'
import type { IntegrationSecurityTransport, TransportResult } from '../src/contracts'

const instant = '2026-07-24T10:00:00.000Z'
const ok = (items: unknown[]): TransportResult => ({ body: { data: { items }, meta: { request_id: 'req_test' } }, headers: new Headers(), status: 200 })
const machine = { identity_key: `machine_${'a'.repeat(32)}`, name: 'Worker', scopes: ['data.export.read'], status: 'active', token_prefix: 'pa_mi_AbCd12', token_last_four: 'Z_09', expires_at: null, last_used_at: null, revision: 1, created_at: instant }
const webhook = { endpoint_key: `webhook_${'b'.repeat(32)}`, name: 'Receiver', url: 'https://hooks.example.com/', events: ['audit.event.created'], status: 'active', revision: 1, created_at: instant }
const session = { session_key: '01J00000000000000000000000', client_key: 'admin-web', status: 'active', current: true, masked_ip: '203.0.113.*', user_agent_fingerprint: '0123456789ab', issued_at: instant, last_seen_at: instant, absolute_expires_at: instant, revoked_at: null }
const transport = (): IntegrationSecurityTransport => ({
  machines: vi.fn(async () => ok([machine])), webhooks: vi.fn(async () => ok([webhook])), sessions: vi.fn(async () => ok([session])),
  revokeSession: vi.fn(async () => ({ body: { data: { ...session, status: 'revoked', revoked_at: instant }, meta: { request_id: 'req_revoke' } }, headers: new Headers(), status: 200 })),
})

describe('integration security runtime', () => {
  it('loads three permission-gated surfaces and revokes only a selected session key', async () => {
    const api = transport(); const runtime = createIntegrationSecurityRuntime({ transport: api, canRead: () => true, canRevokeSession: () => true })
    await runtime.load(); expect(runtime.state.machines).toHaveLength(1); expect(runtime.state.webhooks).toHaveLength(1); expect(runtime.state.sessions).toHaveLength(1)
    await runtime.revokeSession(runtime.state.sessions[0]!)
    expect(api.revokeSession).toHaveBeenCalledWith(session.session_key, expect.any(AbortSignal))
  })

  it('fails closed and cannot rehydrate disposed Tenant state', async () => {
    const deniedApi = transport(); const denied = createIntegrationSecurityRuntime({ transport: deniedApi, canRead: () => false, canRevokeSession: () => false })
    await denied.load(); expect(denied.state.error?.message).toContain('could not be loaded'); expect(deniedApi.machines).not.toHaveBeenCalled()

    let resolveMachines: ((value: TransportResult) => void) | undefined
    const delayed = new Promise<TransportResult>(resolve => { resolveMachines = resolve })
    const api = transport(); api.machines = vi.fn(async () => delayed)
    const runtime = createIntegrationSecurityRuntime({ transport: api, canRead: () => true, canRevokeSession: () => true })
    const loading = runtime.load(); runtime.dispose(); resolveMachines?.(ok([machine])); await loading
    expect(runtime.state.machines).toEqual([]); expect(runtime.state.webhooks).toEqual([]); expect(runtime.state.sessions).toEqual([])
  })
})
