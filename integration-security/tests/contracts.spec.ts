import { describe, expect, it } from 'vitest'
import { parseMachine, parseSession, parseWebhook } from '../src/contracts'

const instant = '2026-07-24T10:00:00.000Z'
describe('integration security response contracts', () => {
  it('accepts redacted machine, endpoint, and session records', () => {
    expect(parseMachine({
      identity_key: `machine_${'a'.repeat(32)}`, name: 'Export worker', scopes: ['data.export.read'], status: 'active',
      token_prefix: 'pa_mi_AbCd12', token_last_four: 'Z_09', expires_at: null, last_used_at: null, revision: 1, created_at: instant,
    }).tokenLastFour).toBe('Z_09')
    expect(parseWebhook({
      endpoint_key: `webhook_${'b'.repeat(32)}`, name: 'Audit receiver', url: 'https://hooks.example.com/events',
      events: ['audit.event.created'], status: 'active', revision: 1, created_at: instant,
    }).url).toContain('hooks.example.com')
    expect(parseSession({
      session_key: '01J00000000000000000000000', client_key: 'admin-web', status: 'active', current: true,
      masked_ip: '203.0.113.*', user_agent_fingerprint: '0123456789ab', issued_at: instant, last_seen_at: instant,
      absolute_expires_at: instant, revoked_at: null,
    }).current).toBe(true)
  })

  it('rejects secret/token/tenant additions and malformed state', () => {
    expect(() => parseMachine({
      identity_key: `machine_${'a'.repeat(32)}`, name: 'Worker', scopes: ['data.export.read'], status: 'active',
      token_prefix: 'pa_mi_AbCd12', token_last_four: 'Z_09', expires_at: null, last_used_at: null, revision: 1, created_at: instant,
      token: 'secret',
    })).toThrow('INTEGRATION_RESPONSE_INVALID')
    expect(() => parseWebhook({
      endpoint_key: `webhook_${'b'.repeat(32)}`, name: 'Receiver', url: 'http://127.0.0.1', events: ['audit.event.created'],
      status: 'active', revision: 1, created_at: instant, secret: 'secret',
    })).toThrow('INTEGRATION_RESPONSE_INVALID')
  })
})
