import { describe, expect, it } from 'vitest'
import { parseAttempt, parseDelivery, parseMachine, parsePage, parseProvisionedMachine, parseProvisionedWebhook, parseSession, parseWebhook } from '../src/contracts'

const instant = '2026-07-24T10:00:00.000Z'
const machine = { identity_key: `machine_${'a'.repeat(32)}`, name: 'Export worker', scopes: ['data.export.read'], status: 'active', token_prefix: 'pa_mi_AbCd12', token_last_four: 'Z_09', expires_at: null, last_used_at: null, revision: 1, created_at: instant }
const webhook = { endpoint_key: `webhook_${'b'.repeat(32)}`, name: 'Audit receiver', url: 'https://hooks.example.com/events', events: ['audit.event.created'], status: 'active', revision: 1, created_at: instant }
const delivery = { delivery_key: `delivery_${'d'.repeat(32)}`, endpoint_key: webhook.endpoint_key, event_type: 'audit.event.created', status: 'delivered', attempt_count: 1, last_status_code: 204, last_error_code: null, created_at: instant, updated_at: instant, delivered_at: instant }

describe('integration security response contracts', () => {
  it('accepts only redacted records and one-time credential disclosures', () => {
    expect(parseMachine(machine).tokenLastFour).toBe('Z_09')
    expect(parseWebhook(webhook).url).toContain('hooks.example.com')
    expect(parseProvisionedMachine({ identity: machine, token: `pa_mi_${'A'.repeat(43)}` }).token).toMatch(/^pa_mi_/)
    expect(parseProvisionedWebhook({ endpoint: webhook, signing_secret: `whsec_${'B'.repeat(43)}` }).signingSecret).toMatch(/^whsec_/)
    expect(parseSession({ session_key: '01J00000000000000000000000', client_key: 'admin-web', status: 'active', current: true, masked_ip: '203.0.113.*', user_agent_fingerprint: '0123456789ab', issued_at: instant, last_seen_at: instant, absolute_expires_at: instant, revoked_at: null }).current).toBe(true)
  })

  it('parses redacted paginated delivery and attempt evidence', () => {
    expect(parsePage({ data: { items: [delivery], page: 1, page_size: 20, total: 1 }, meta: { request_id: 'req_test' } }, parseDelivery).total).toBe(1)
    expect(parseAttempt({ attempt_number: 1, outcome: 'delivered', response_status: 204, error_code: null, duration_ms: 12, attempted_at: instant }).durationMs).toBe(12)
  })

  it('rejects secret, payload, network, and malformed pagination additions', () => {
    expect(() => parseMachine({ ...machine, token: 'secret' })).toThrow('INTEGRATION_RESPONSE_INVALID')
    expect(() => parseWebhook({ ...webhook, secret: 'secret' })).toThrow('INTEGRATION_RESPONSE_INVALID')
    expect(() => parseDelivery({ ...delivery, payload: { secret: true } })).toThrow('INTEGRATION_RESPONSE_INVALID')
    expect(() => parsePage({ data: { items: [delivery], page: 1, page_size: 20, total: 1 }, meta: { request_id: 'bad' } }, parseDelivery)).toThrow('INTEGRATION_RESPONSE_INVALID')
  })
})
