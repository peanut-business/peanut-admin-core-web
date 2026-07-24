import { defineAdminModule } from '@peanut-admin/admin-core'
import { inject, reactive } from 'vue'
import type { AdminModuleContribution } from '@peanut-admin/admin-core'
import type { InjectionKey } from 'vue'
import { parseAttempt, parseDelivery, parseItem, parseList, parseMachine, parsePage, parseProvisionedMachine, parseProvisionedWebhook, parseSession, parseWebhook } from './contracts'
import type { IntegrationSecurityTransport, MachineIdentity, Page, ProvisionedMachineIdentity, ProvisionedWebhookEndpoint, SessionDevice, TransportResult, WebhookAttemptRecord, WebhookDeliveryRecord, WebhookEndpoint } from './contracts'

export const INTEGRATION_SECURITY_MODULE_KEY = 'peanut.integration-security' as const
export const INTEGRATION_SECURITY_ROUTE_PATH = '/app/integration-security' as const
export const INTEGRATION_SECURITY_ROUTE_PERMISSION = 'peanut.integration-security.access' as const
export const INTEGRATION_SECURITY_READ_PERMISSIONS = [
  'peanut.integration-security.machine.read', 'peanut.integration-security.webhook.read',
  'peanut.integration-security.delivery.read', 'peanut.integration-security.session.read',
] as const

export interface RuntimeError { readonly message: string; readonly requestId: string | null; readonly status: number | null }
export interface SurfaceState<T> { items: T[]; loading: boolean; error: RuntimeError | null }
export interface IntegrationSecurityState {
  machines: SurfaceState<MachineIdentity>; webhooks: SurfaceState<WebhookEndpoint>
  deliveries: SurfaceState<WebhookDeliveryRecord> & { page: number; pageSize: number; total: number }
  attempts: SurfaceState<WebhookAttemptRecord> & { deliveryKey: string | null }
  sessions: SurfaceState<SessionDevice>; mutating: boolean
  disclosure: { kind: 'machine-token' | 'webhook-secret'; value: string } | null
}
export interface IntegrationSecurityRuntime {
  readonly state: IntegrationSecurityState
  load: () => Promise<void>; loadMachines: () => Promise<void>; loadWebhooks: () => Promise<void>; loadDeliveries: (page?: number) => Promise<void>; loadAttempts: (deliveryKey: string) => Promise<void>; loadSessions: () => Promise<void>
  createMachine: (input: { name: string; scopes: string[]; expires_at: string | null }) => Promise<void>
  rotateMachine: (identity: MachineIdentity) => Promise<void>; revokeMachine: (identity: MachineIdentity) => Promise<void>
  createWebhook: (input: { name: string; url: string; events: string[] }) => Promise<void>
  rotateWebhook: (endpoint: WebhookEndpoint) => Promise<void>; disableWebhook: (endpoint: WebhookEndpoint) => Promise<void>
  revokeSession: (session: SessionDevice) => Promise<void>; clearDisclosure: () => void; dispose: () => void
  readonly can: IntegrationSecurityPermissions
}
export interface IntegrationSecurityPermissions {
  readonly canReadMachines: () => boolean; readonly canManageMachines: () => boolean
  readonly canReadWebhooks: () => boolean; readonly canManageWebhooks: () => boolean
  readonly canReadDeliveries: () => boolean; readonly canReadSessions: () => boolean; readonly canRevokeSession: () => boolean
}

const requestIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/
const messages: Readonly<Record<string, string>> = {
  INTEGRATION_PERMISSION_DENIED: 'You do not have permission to perform this action.',
  INTEGRATION_INPUT_INVALID: 'The submitted integration settings are invalid.',
  MACHINE_IDENTITY_NOT_FOUND: 'The machine identity is unavailable.',
  MACHINE_SCOPE_DENIED: 'One or more machine scopes cannot be granted.',
  INTEGRATION_REVISION_CONFLICT: 'This record changed. Refresh and try again.',
  WEBHOOK_ENDPOINT_NOT_FOUND: 'The webhook endpoint is unavailable.',
  WEBHOOK_DESTINATION_DENIED: 'The webhook destination is not allowed.',
  SESSION_DEVICE_NOT_FOUND: 'The session is unavailable.',
}
const failure = (result: TransportResult): RuntimeError => {
  const body = typeof result.body === 'object' && result.body !== null && !Array.isArray(result.body) ? result.body as Record<string, unknown> : {}
  const code = typeof body.code === 'string' && /^[A-Z][A-Z0-9_]{2,63}$/.test(body.code) ? body.code : ''
  const candidate = body.request_id ?? result.headers.get('X-Request-Id')
  return { message: messages[code] ?? 'The integration security request failed.', requestId: typeof candidate === 'string' && requestIdPattern.test(candidate) ? candidate : null, status: result.status }
}
const localFailure = (message: string): RuntimeError => ({ message, requestId: null, status: null })

export const createIntegrationSecurityRuntime = (options: { readonly transport: IntegrationSecurityTransport; readonly permissions: IntegrationSecurityPermissions }): IntegrationSecurityRuntime => {
  const state = reactive<IntegrationSecurityState>({
    machines: { items: [], loading: false, error: null }, webhooks: { items: [], loading: false, error: null },
    deliveries: { items: [], loading: false, error: null, page: 1, pageSize: 20, total: 0 },
    attempts: { items: [], loading: false, error: null, deliveryKey: null },
    sessions: { items: [], loading: false, error: null }, mutating: false, disclosure: null,
  })
  const controllers = new Set<AbortController>(); let generation = 0
  const run = async <T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> => {
    const controller = new AbortController(); controllers.add(controller)
    try { return await operation(controller.signal) } finally { controllers.delete(controller) }
  }
  const loadSurface = async <T>(surface: SurfaceState<T>, allowed: () => boolean, request: (signal: AbortSignal) => Promise<TransportResult>, parser: (body: unknown) => T[]): Promise<void> => {
    const current = generation; surface.loading = true; surface.error = null
    if (!allowed()) { surface.items = []; surface.loading = false; surface.error = localFailure('You do not have permission to view this section.'); return }
    try {
      const result = await run(request)
      if (current !== generation) return
      if (result.status !== 200) { surface.error = failure(result); return }
      surface.items = parser(result.body)
    } catch { if (current === generation) surface.error = localFailure('This section could not be loaded.') }
    finally { if (current === generation) surface.loading = false }
  }
  const loadMachines = () => loadSurface(state.machines, options.permissions.canReadMachines, options.transport.machines, body => parseList(body, parseMachine))
  const loadWebhooks = () => loadSurface(state.webhooks, options.permissions.canReadWebhooks, options.transport.webhooks, body => parseList(body, parseWebhook))
  const loadSessions = () => loadSurface(state.sessions, options.permissions.canReadSessions, options.transport.sessions, body => parseList(body, parseSession))
  const loadDeliveries = async (page = state.deliveries.page): Promise<void> => {
    const current = generation; const surface = state.deliveries; surface.loading = true; surface.error = null
    if (!options.permissions.canReadDeliveries()) { surface.items = []; surface.total = 0; surface.loading = false; surface.error = localFailure('You do not have permission to view this section.'); return }
    try {
      const result = await run(signal => options.transport.deliveries(page, surface.pageSize, signal))
      if (current !== generation) return
      if (result.status !== 200) { surface.error = failure(result); return }
      const parsed: Page<WebhookDeliveryRecord> = parsePage(result.body, parseDelivery)
      surface.items = parsed.items; surface.page = parsed.page; surface.pageSize = parsed.pageSize; surface.total = parsed.total
    } catch { if (current === generation) surface.error = localFailure('Delivery evidence could not be loaded.') }
    finally { if (current === generation) surface.loading = false }
  }
  const loadAttempts = async (deliveryKey: string): Promise<void> => {
    const surface = state.attempts; surface.deliveryKey = deliveryKey
    await loadSurface(surface, options.permissions.canReadDeliveries, signal => options.transport.deliveryAttempts(deliveryKey, 1, 100, signal), body => parsePage(body, parseAttempt).items)
  }
  const mutate = async <T>(allowed: () => boolean, request: (signal: AbortSignal) => Promise<TransportResult>, parser: (body: unknown) => T, after: (value: T) => Promise<void>, surface: SurfaceState<unknown>): Promise<void> => {
    if (state.mutating || !allowed()) return
    const current = generation; state.mutating = true; surface.error = null; state.disclosure = null
    try {
      const result = await run(request)
      if (current !== generation) return
      if (result.status < 200 || result.status >= 300) { surface.error = failure(result); return }
      await after(parser(result.body))
    } catch { if (current === generation) surface.error = localFailure('The requested change could not be completed.') }
    finally { if (current === generation) state.mutating = false }
  }
  return {
    state, can: options.permissions, load: async () => { await Promise.allSettled([loadMachines(), loadWebhooks(), loadDeliveries(), loadSessions()]) },
    loadMachines, loadWebhooks, loadDeliveries, loadAttempts, loadSessions,
    createMachine: input => mutate(options.permissions.canManageMachines, signal => options.transport.createMachine(input, signal), body => parseItem(body, parseProvisionedMachine), async (value: ProvisionedMachineIdentity) => { state.disclosure = { kind: 'machine-token', value: value.token }; await loadMachines() }, state.machines),
    rotateMachine: identity => mutate(options.permissions.canManageMachines, signal => options.transport.rotateMachine(identity.identityKey, identity.revision, signal), body => parseItem(body, parseProvisionedMachine), async (value: ProvisionedMachineIdentity) => { state.disclosure = { kind: 'machine-token', value: value.token }; await loadMachines() }, state.machines),
    revokeMachine: identity => mutate(options.permissions.canManageMachines, signal => options.transport.revokeMachine(identity.identityKey, identity.revision, signal), body => parseItem(body, parseMachine), async () => loadMachines(), state.machines),
    createWebhook: input => mutate(options.permissions.canManageWebhooks, signal => options.transport.createWebhook(input, signal), body => parseItem(body, parseProvisionedWebhook), async (value: ProvisionedWebhookEndpoint) => { state.disclosure = { kind: 'webhook-secret', value: value.signingSecret }; await loadWebhooks() }, state.webhooks),
    rotateWebhook: endpoint => mutate(options.permissions.canManageWebhooks, signal => options.transport.rotateWebhook(endpoint.endpointKey, endpoint.revision, signal), body => parseItem(body, parseProvisionedWebhook), async (value: ProvisionedWebhookEndpoint) => { state.disclosure = { kind: 'webhook-secret', value: value.signingSecret }; await loadWebhooks() }, state.webhooks),
    disableWebhook: endpoint => mutate(options.permissions.canManageWebhooks, signal => options.transport.disableWebhook(endpoint.endpointKey, endpoint.revision, signal), body => parseItem(body, parseWebhook), async () => loadWebhooks(), state.webhooks),
    revokeSession: session => mutate(options.permissions.canRevokeSession, signal => options.transport.revokeSession(session.sessionKey, signal), body => parseItem(body, parseSession), async () => loadSessions(), state.sessions),
    clearDisclosure: () => { state.disclosure = null },
    dispose() {
      generation += 1; for (const controller of controllers) controller.abort(); controllers.clear()
      state.machines.items = []; state.webhooks.items = []; state.deliveries.items = []; state.attempts.items = []; state.sessions.items = []
      state.machines.loading = state.webhooks.loading = state.deliveries.loading = state.attempts.loading = state.sessions.loading = false
      state.machines.error = state.webhooks.error = state.deliveries.error = state.attempts.error = state.sessions.error = null
      state.attempts.deliveryKey = null
      state.deliveries.total = 0; state.deliveries.page = 1; state.mutating = false; state.disclosure = null
    },
  }
}
export const integrationSecurityRuntimeKey: InjectionKey<IntegrationSecurityRuntime> = Symbol('peanut.integration-security.runtime')
export const useIntegrationSecurityRuntime = (): IntegrationSecurityRuntime => { const runtime = inject(integrationSecurityRuntimeKey); if (runtime === undefined) throw new Error('INTEGRATION_SECURITY_RUNTIME_MISSING'); return runtime }
export const createIntegrationSecurityModuleContribution = (runtime: IntegrationSecurityRuntime): AdminModuleContribution => defineAdminModule({
  key: INTEGRATION_SECURITY_MODULE_KEY,
  routes: [{ name: 'peanut.integration-security.index', path: INTEGRATION_SECURITY_ROUTE_PATH, component: async () => ({ default: (await import('./IntegrationSecurityPage.vue')).default }), access: { moduleKey: INTEGRATION_SECURITY_MODULE_KEY, permissionKeys: [INTEGRATION_SECURITY_ROUTE_PERMISSION] } }],
  disposeOnTenantChange: true, stores: [{ key: 'peanut.integration-security.runtime', dispose: runtime.dispose }],
})
