export type MachineStatus = 'active' | 'rotated' | 'revoked'
export type WebhookStatus = 'active' | 'disabled'

export interface MachineIdentity {
  readonly identityKey: string; readonly name: string; readonly scopes: readonly string[]
  readonly status: MachineStatus; readonly tokenPrefix: string; readonly tokenLastFour: string
  readonly expiresAt: string | null; readonly lastUsedAt: string | null; readonly revision: number; readonly createdAt: string
}
export interface WebhookEndpoint {
  readonly endpointKey: string; readonly name: string; readonly url: string; readonly events: readonly string[]
  readonly status: WebhookStatus; readonly revision: number; readonly createdAt: string
}
export interface SessionDevice {
  readonly sessionKey: string; readonly clientKey: string; readonly status: 'active' | 'revoked' | 'expired'
  readonly current: boolean; readonly maskedIp: string | null; readonly userAgentFingerprint: string | null
  readonly issuedAt: string; readonly lastSeenAt: string; readonly absoluteExpiresAt: string; readonly revokedAt: string | null
}
export interface IntegrationSecuritySnapshot {
  readonly machines: readonly MachineIdentity[]; readonly webhooks: readonly WebhookEndpoint[]; readonly sessions: readonly SessionDevice[]
}
export interface TransportResult { readonly body: unknown; readonly headers: Headers; readonly status: number }
export interface IntegrationSecurityTransport {
  machines: (signal: AbortSignal) => Promise<TransportResult>
  webhooks: (signal: AbortSignal) => Promise<TransportResult>
  sessions: (signal: AbortSignal) => Promise<TransportResult>
  revokeSession: (sessionKey: string, signal: AbortSignal) => Promise<TransportResult>
}

const record = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('INTEGRATION_RESPONSE_INVALID')
  return value as Record<string, unknown>
}
const exact = (value: Record<string, unknown>, keys: readonly string[]): void => {
  const actual = Object.keys(value).sort(); const expected = [...keys].sort()
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new Error('INTEGRATION_RESPONSE_INVALID')
}
const instant = (value: unknown): value is string => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value))
const qualified = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$/

export const parseMachine = (value: unknown): MachineIdentity => {
  const item = record(value)
  exact(item, ['identity_key', 'name', 'scopes', 'status', 'token_prefix', 'token_last_four', 'expires_at', 'last_used_at', 'revision', 'created_at'])
  if (typeof item.identity_key !== 'string' || !/^machine_[0-9a-f]{32}$/.test(item.identity_key)
    || typeof item.name !== 'string' || item.name === '' || [...item.name].length > 120
    || !Array.isArray(item.scopes) || item.scopes.length < 1 || item.scopes.length > 32 || item.scopes.some(scope => typeof scope !== 'string' || !qualified.test(scope))
    || new Set(item.scopes).size !== item.scopes.length || [...item.scopes].sort().some((scope, index) => scope !== item.scopes[index])
    || !['active', 'rotated', 'revoked'].includes(String(item.status))
    || typeof item.token_prefix !== 'string' || !item.token_prefix.startsWith('pa_mi_')
    || typeof item.token_last_four !== 'string' || !/^[A-Za-z0-9_-]{4}$/.test(item.token_last_four)
    || (item.expires_at !== null && !instant(item.expires_at)) || (item.last_used_at !== null && !instant(item.last_used_at))
    || typeof item.revision !== 'number' || !Number.isSafeInteger(item.revision) || item.revision < 1 || !instant(item.created_at)
  ) throw new Error('INTEGRATION_RESPONSE_INVALID')
  return {
    identityKey: item.identity_key, name: item.name, scopes: item.scopes as string[], status: item.status as MachineStatus,
    tokenPrefix: item.token_prefix, tokenLastFour: item.token_last_four, expiresAt: item.expires_at as string | null,
    lastUsedAt: item.last_used_at as string | null, revision: item.revision, createdAt: item.created_at,
  }
}
export const parseWebhook = (value: unknown): WebhookEndpoint => {
  const item = record(value)
  exact(item, ['endpoint_key', 'name', 'url', 'events', 'status', 'revision', 'created_at'])
  if (typeof item.endpoint_key !== 'string' || !/^webhook_[0-9a-f]{32}$/.test(item.endpoint_key)
    || typeof item.name !== 'string' || item.name === '' || [...item.name].length > 120
    || typeof item.url !== 'string' || !item.url.startsWith('https://') || item.url.length > 2048
    || !Array.isArray(item.events) || item.events.length < 1 || item.events.length > 32 || item.events.some(event => typeof event !== 'string' || !qualified.test(event))
    || new Set(item.events).size !== item.events.length || !['active', 'disabled'].includes(String(item.status))
    || typeof item.revision !== 'number' || !Number.isSafeInteger(item.revision) || item.revision < 1 || !instant(item.created_at)
  ) throw new Error('INTEGRATION_RESPONSE_INVALID')
  return { endpointKey: item.endpoint_key, name: item.name, url: item.url, events: item.events as string[], status: item.status as WebhookStatus, revision: item.revision, createdAt: item.created_at }
}
export const parseSession = (value: unknown): SessionDevice => {
  const item = record(value)
  exact(item, ['session_key', 'client_key', 'status', 'current', 'masked_ip', 'user_agent_fingerprint', 'issued_at', 'last_seen_at', 'absolute_expires_at', 'revoked_at'])
  if (typeof item.session_key !== 'string' || !/^[0-9A-HJKMNP-TV-Z]{26}$/.test(item.session_key)
    || item.client_key !== 'admin-web' || !['active', 'revoked', 'expired'].includes(String(item.status)) || typeof item.current !== 'boolean'
    || (item.masked_ip !== null && (typeof item.masked_ip !== 'string' || item.masked_ip.length > 45))
    || (item.user_agent_fingerprint !== null && (typeof item.user_agent_fingerprint !== 'string' || !/^[0-9a-f]{12}$/.test(item.user_agent_fingerprint)))
    || !instant(item.issued_at) || !instant(item.last_seen_at) || !instant(item.absolute_expires_at)
    || (item.revoked_at !== null && !instant(item.revoked_at))
  ) throw new Error('INTEGRATION_RESPONSE_INVALID')
  return {
    sessionKey: item.session_key, clientKey: item.client_key, status: item.status as SessionDevice['status'], current: item.current,
    maskedIp: item.masked_ip as string | null, userAgentFingerprint: item.user_agent_fingerprint as string | null,
    issuedAt: item.issued_at, lastSeenAt: item.last_seen_at, absoluteExpiresAt: item.absolute_expires_at, revokedAt: item.revoked_at as string | null,
  }
}
export const parseList = <T>(value: unknown, parser: (item: unknown) => T): T[] => {
  const body = record(value); exact(body, ['data', 'meta']); const data = record(body.data); const meta = record(body.meta)
  exact(data, ['items']); exact(meta, ['request_id'])
  if (!Array.isArray(data.items) || typeof meta.request_id !== 'string' || meta.request_id === '') throw new Error('INTEGRATION_RESPONSE_INVALID')
  return data.items.map(parser)
}
export const createIntegrationSecurityFetchTransport = (options: { readonly baseUrl: string; readonly fetch?: (request: Request) => Promise<Response> }): IntegrationSecurityTransport => {
  const fetcher = options.fetch ?? fetch
  const request = async (path: string, init: RequestInit): Promise<TransportResult> => {
    const response = await fetcher(new Request(new URL(path, options.baseUrl), { credentials: 'include', ...init, headers: { Accept: 'application/json', ...init.headers } }))
    return { body: await response.json(), headers: response.headers, status: response.status }
  }
  return {
    machines: signal => request('/api/v1/integration-security/machine-identities', { method: 'GET', signal }),
    webhooks: signal => request('/api/v1/integration-security/webhooks', { method: 'GET', signal }),
    sessions: signal => request('/api/v1/integration-security/sessions', { method: 'GET', signal }),
    revokeSession: (sessionKey, signal) => request(`/api/v1/integration-security/sessions/${encodeURIComponent(sessionKey)}/revoke`, { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' }, signal }),
  }
}
