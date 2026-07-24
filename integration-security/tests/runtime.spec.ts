import { describe, expect, it, vi } from 'vitest'
import { createIntegrationSecurityRuntime } from '../src/runtime'
import type { IntegrationSecurityPermissions } from '../src/runtime'
import type { IntegrationSecurityTransport, SessionDevice, TransportResult } from '../src/contracts'

const instant = '2026-07-24T10:00:00.000Z'
const response = (data: unknown, status = 200): TransportResult => ({ body: { data, meta: { request_id: 'req_test' } }, headers: new Headers(), status })
const list = (items: unknown[]): TransportResult => response({ items })
const page = (items: unknown[], currentPage = 1): TransportResult => response({ items, page: currentPage, page_size: 20, total: items.length })
const machine = { identity_key: `machine_${'a'.repeat(32)}`, name: 'Worker', scopes: ['data.export.read'], status: 'active', token_prefix: 'pa_mi_AbCd12', token_last_four: 'Z_09', expires_at: null, last_used_at: null, revision: 1, created_at: instant }
const webhook = { endpoint_key: `webhook_${'b'.repeat(32)}`, name: 'Receiver', url: 'https://hooks.example.com/', events: ['audit.event.created'], status: 'active', revision: 1, created_at: instant }
const delivery = { delivery_key: `delivery_${'d'.repeat(32)}`, endpoint_key: webhook.endpoint_key, event_type: 'audit.event.created', status: 'delivered', attempt_count: 1, last_status_code: 204, last_error_code: null, created_at: instant, updated_at: instant, delivered_at: instant }
const session = { session_key: '01J00000000000000000000000', client_key: 'admin-web', status: 'active', current: true, masked_ip: '203.0.113.*', user_agent_fingerprint: '0123456789ab', issued_at: instant, last_seen_at: instant, absolute_expires_at: instant, revoked_at: null }
const sessionDevice: SessionDevice = { sessionKey: session.session_key, clientKey: session.client_key, status: 'active', current: true, maskedIp: session.masked_ip, userAgentFingerprint: session.user_agent_fingerprint, issuedAt: instant, lastSeenAt: instant, absoluteExpiresAt: instant, revokedAt: null }
const transport = (): IntegrationSecurityTransport => ({
  machines: vi.fn(async () => list([machine])), createMachine: vi.fn(async () => response({ identity: machine, token: `pa_mi_${'A'.repeat(43)}` })), rotateMachine: vi.fn(async () => response({ identity: machine, token: `pa_mi_${'B'.repeat(43)}` })), revokeMachine: vi.fn(async () => response({ ...machine, status: 'revoked', revision: 2 })),
  webhooks: vi.fn(async () => list([webhook])), createWebhook: vi.fn(async () => response({ endpoint: webhook, signing_secret: `whsec_${'C'.repeat(43)}` })), rotateWebhook: vi.fn(async () => response({ endpoint: { ...webhook, revision: 2 }, signing_secret: `whsec_${'D'.repeat(43)}` })), disableWebhook: vi.fn(async () => response({ ...webhook, status: 'disabled', revision: 2 })),
  deliveries: vi.fn(async () => page([delivery])), deliveryAttempts: vi.fn(async () => page([{ attempt_number: 1, outcome: 'delivered', response_status: 204, error_code: null, duration_ms: 12, attempted_at: instant }])),
  sessions: vi.fn(async () => list([session])), revokeSession: vi.fn(async () => response({ ...session, status: 'revoked', revoked_at: instant })),
})
const permissions = (overrides: Partial<Record<keyof IntegrationSecurityPermissions, boolean>> = {}): IntegrationSecurityPermissions => {
  const allowed = (key: keyof IntegrationSecurityPermissions) => () => overrides[key] ?? true
  return { canReadMachines: allowed('canReadMachines'), canManageMachines: allowed('canManageMachines'), canReadWebhooks: allowed('canReadWebhooks'), canManageWebhooks: allowed('canManageWebhooks'), canReadDeliveries: allowed('canReadDeliveries'), canReadSessions: allowed('canReadSessions'), canRevokeSession: allowed('canRevokeSession') }
}

describe('integration security runtime', () => {
  it('loads each read surface independently and does not let one permission block the others', async () => {
    const api = transport(); const runtime = createIntegrationSecurityRuntime({ transport: api, permissions: permissions({ canReadWebhooks: false }) })
    await runtime.load()
    expect(runtime.state.machines.items).toHaveLength(1); expect(runtime.state.webhooks.items).toEqual([]); expect(runtime.state.webhooks.error?.code).toBe('INTEGRATION_PERMISSION_DENIED')
    expect(runtime.state.deliveries.items).toHaveLength(1); expect(runtime.state.sessions.items).toHaveLength(1); expect(api.webhooks).not.toHaveBeenCalled()
  })

  it('records denied mutations on the owning surface without calling transport', async () => {
    const api = transport(); const runtime = createIntegrationSecurityRuntime({ transport: api, permissions: permissions({ canManageMachines: false }) })
    await runtime.createMachine({ name: 'Denied', scopes: ['data.export.read'], expires_at: null })
    expect(runtime.state.machines.error?.code).toBe('INTEGRATION_PERMISSION_DENIED'); expect(api.createMachine).not.toHaveBeenCalled()
  })

  it('supports management actions and discloses newly issued credentials once', async () => {
    const api = transport(); const runtime = createIntegrationSecurityRuntime({ transport: api, permissions: permissions() })
    await runtime.createMachine({ name: 'Worker', scopes: ['data.export.read'], expires_at: null })
    expect(runtime.state.disclosure?.kind).toBe('machine-token'); runtime.clearDisclosure(); expect(runtime.state.disclosure).toBeNull()
    await runtime.createWebhook({ name: 'Receiver', url: 'https://hooks.example.com/', events: ['audit.event.created'] })
    expect(runtime.state.disclosure?.kind).toBe('webhook-secret')
    await runtime.revokeSession(sessionDevice)
    expect(api.revokeSession).toHaveBeenCalledWith(session.session_key, expect.any(AbortSignal))
  })

  it('accepts redacted idempotency replays without disclosing credentials again', async () => {
    const api = transport()
    api.createMachine = vi.fn(async () => response(machine, 201))
    api.rotateWebhook = vi.fn(async () => response({ ...webhook, revision: 2 }))
    const runtime = createIntegrationSecurityRuntime({ transport: api, permissions: permissions() })
    await runtime.createMachine({ name: 'Worker', scopes: ['data.export.read'], expires_at: null })
    expect(runtime.state.machines.error).toBeNull()
    expect(runtime.state.disclosure).toBeNull()
    await runtime.rotateWebhook({ endpointKey: webhook.endpoint_key, name: webhook.name, url: webhook.url, events: webhook.events, status: 'active', revision: 1, createdAt: instant })
    expect(runtime.state.webhooks.error).toBeNull()
    expect(runtime.state.disclosure).toBeNull()
  })

  it('never renders server detail and validates request ids', async () => {
    const api = transport(); api.machines = vi.fn(async () => ({ body: { code: 'MACHINE_SCOPE_DENIED', detail: 'token=secret', request_id: '<script>' }, headers: new Headers(), status: 403 }))
    const runtime = createIntegrationSecurityRuntime({ transport: api, permissions: permissions() }); await runtime.loadMachines()
    expect(runtime.state.machines.error?.code).toBe('MACHINE_SCOPE_DENIED'); expect(runtime.state.machines.error?.message).toBe('One or more machine scopes cannot be granted.'); expect(runtime.state.machines.error?.message).not.toContain('secret'); expect(runtime.state.machines.error?.requestId).toBeNull()
  })

  it('uses stable local codes for network and parse failures', async () => {
    const api = transport(); api.machines = vi.fn(async () => { throw new Error('offline') })
    const runtime = createIntegrationSecurityRuntime({ transport: api, permissions: permissions() }); await runtime.loadMachines()
    expect(runtime.state.machines.error?.code).toBe('INTEGRATION_NETWORK_FAILED')
    api.machines = vi.fn(async () => response({ items: [{ unsafe: true }] })); await runtime.loadMachines()
    expect(runtime.state.machines.error?.code).toBe('INTEGRATION_RESPONSE_INVALID')
  })

  it('ignores stale delivery pages and stale selected-delivery attempts', async () => {
    let resolveDeliveryOne: ((value: TransportResult) => void) | undefined; let resolveDeliveryTwo: ((value: TransportResult) => void) | undefined
    let resolveAttemptOne: ((value: TransportResult) => void) | undefined; let resolveAttemptTwo: ((value: TransportResult) => void) | undefined
    const api = transport()
    api.deliveries = vi.fn((requestedPage) => new Promise<TransportResult>(resolve => { if (requestedPage === 1) resolveDeliveryOne = resolve; else resolveDeliveryTwo = resolve }))
    api.deliveryAttempts = vi.fn((deliveryKey) => new Promise<TransportResult>(resolve => { if (deliveryKey.endsWith('1')) resolveAttemptOne = resolve; else resolveAttemptTwo = resolve }))
    const runtime = createIntegrationSecurityRuntime({ transport: api, permissions: permissions() })
    const oldPage = runtime.loadDeliveries(1); const newPage = runtime.loadDeliveries(2)
    resolveDeliveryTwo?.(page([{ ...delivery, delivery_key: `delivery_${'e'.repeat(32)}` }], 2)); await newPage
    resolveDeliveryOne?.(page([delivery], 1)); await oldPage
    expect(runtime.state.deliveries.page).toBe(2); expect(runtime.state.deliveries.items[0]?.deliveryKey).toBe(`delivery_${'e'.repeat(32)}`)
    const firstKey = `delivery_${'0'.repeat(31)}1`; const secondKey = `delivery_${'0'.repeat(31)}2`
    const oldAttempts = runtime.loadAttempts(firstKey); const newAttempts = runtime.loadAttempts(secondKey)
    resolveAttemptTwo?.(page([{ attempt_number: 2, outcome: 'delivered', response_status: 204, error_code: null, duration_ms: 8, attempted_at: instant }])); await newAttempts
    resolveAttemptOne?.(page([{ attempt_number: 1, outcome: 'retryable', response_status: null, error_code: 'WEBHOOK_LEASE_EXPIRED', duration_ms: 0, attempted_at: instant }])); await oldAttempts
    expect(runtime.state.attempts.deliveryKey).toBe(secondKey); expect(runtime.state.attempts.items[0]?.attemptNumber).toBe(2)
  })

  it('cannot rehydrate disposed Tenant state', async () => {
    let resolveMachines: ((value: TransportResult) => void) | undefined
    const delayed = new Promise<TransportResult>(resolve => { resolveMachines = resolve })
    const api = transport(); api.machines = vi.fn(async () => delayed)
    const runtime = createIntegrationSecurityRuntime({ transport: api, permissions: permissions() })
    const loading = runtime.loadMachines(); runtime.dispose(); resolveMachines?.(list([machine])); await loading
    expect(runtime.state.machines.items).toEqual([])
  })
})
