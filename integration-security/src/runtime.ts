import { defineAdminModule } from '@peanut-admin/admin-core'
import { inject, reactive } from 'vue'
import type { AdminModuleContribution } from '@peanut-admin/admin-core'
import type { InjectionKey } from 'vue'
import { parseList, parseMachine, parseSession, parseWebhook } from './contracts'
import type { IntegrationSecuritySnapshot, IntegrationSecurityTransport, SessionDevice, TransportResult } from './contracts'

export const INTEGRATION_SECURITY_MODULE_KEY = 'peanut.integration-security' as const
export const INTEGRATION_SECURITY_ROUTE_PATH = '/app/integration-security' as const
export const INTEGRATION_SECURITY_READ_PERMISSIONS = [
  'peanut.integration-security.machine.read', 'peanut.integration-security.webhook.read', 'peanut.integration-security.session.read',
] as const
export interface RuntimeError { readonly message: string; readonly requestId: string | null; readonly status: number | null }
export interface IntegrationSecurityState {
  machines: IntegrationSecuritySnapshot['machines']; webhooks: IntegrationSecuritySnapshot['webhooks']; sessions: IntegrationSecuritySnapshot['sessions']
  loading: boolean; mutating: boolean; error: RuntimeError | null
}
export interface IntegrationSecurityRuntime {
  readonly state: IntegrationSecurityState; load: () => Promise<void>; revokeSession: (session: SessionDevice) => Promise<void>; dispose: () => void
}
const failure = (result: TransportResult): RuntimeError => {
  const body = typeof result.body === 'object' && result.body !== null && !Array.isArray(result.body) ? result.body as Record<string, unknown> : {}
  const requestId = body.request_id ?? result.headers.get('X-Request-Id')
  return { message: typeof body.detail === 'string' ? body.detail : `Integration security request failed (${result.status}).`, requestId: typeof requestId === 'string' ? requestId : null, status: result.status }
}
export const createIntegrationSecurityRuntime = (options: { readonly transport: IntegrationSecurityTransport; readonly canRead: () => boolean; readonly canRevokeSession: () => boolean }): IntegrationSecurityRuntime => {
  const state = reactive<IntegrationSecurityState>({ machines: [], webhooks: [], sessions: [], loading: false, mutating: false, error: null })
  const controllers = new Set<AbortController>(); let generation = 0
  const run = async <T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> => { const controller = new AbortController(); controllers.add(controller); try { return await operation(controller.signal) } finally { controllers.delete(controller) } }
  const load = async (): Promise<void> => {
    const current = ++generation; state.loading = true; state.error = null
    try {
      if (!options.canRead()) throw new Error('INTEGRATION_PERMISSION_DENIED')
      const [machines, webhooks, sessions] = await Promise.all([
        run(options.transport.machines), run(options.transport.webhooks), run(options.transport.sessions),
      ])
      if (current !== generation) return
      const failed = [machines, webhooks, sessions].find(result => result.status !== 200)
      if (failed !== undefined) { state.error = failure(failed); return }
      state.machines = parseList(machines.body, parseMachine); state.webhooks = parseList(webhooks.body, parseWebhook); state.sessions = parseList(sessions.body, parseSession)
    } catch { if (current === generation) state.error = { message: 'Integration security data could not be loaded.', requestId: null, status: null } }
    finally { if (current === generation) state.loading = false }
  }
  return {
    state, load,
    async revokeSession(session) {
      if (state.mutating || session.status !== 'active' || !options.canRevokeSession()) return
      const current = generation; state.mutating = true; state.error = null
      try {
        const result = await run(signal => options.transport.revokeSession(session.sessionKey, signal))
        if (current !== generation) return
        if (result.status !== 200) { state.error = failure(result); return }
        parseSession((result.body as { data?: unknown }).data)
        state.mutating = false; await load()
      } catch { if (current === generation) state.error = { message: 'The session could not be revoked.', requestId: null, status: null } }
      finally { if (current === generation) state.mutating = false }
    },
    dispose() { generation += 1; for (const controller of controllers) controller.abort(); controllers.clear(); state.machines = []; state.webhooks = []; state.sessions = []; state.loading = false; state.mutating = false; state.error = null },
  }
}
export const integrationSecurityRuntimeKey: InjectionKey<IntegrationSecurityRuntime> = Symbol('peanut.integration-security.runtime')
export const useIntegrationSecurityRuntime = (): IntegrationSecurityRuntime => { const runtime = inject(integrationSecurityRuntimeKey); if (runtime === undefined) throw new Error('INTEGRATION_SECURITY_RUNTIME_MISSING'); return runtime }
export const createIntegrationSecurityModuleContribution = (runtime: IntegrationSecurityRuntime): AdminModuleContribution => defineAdminModule({
  key: INTEGRATION_SECURITY_MODULE_KEY,
  routes: [{ name: 'peanut.integration-security.index', path: INTEGRATION_SECURITY_ROUTE_PATH, component: async () => ({ default: (await import('./IntegrationSecurityPage.vue')).default }), access: { moduleKey: INTEGRATION_SECURITY_MODULE_KEY, permissionKeys: [...INTEGRATION_SECURITY_READ_PERMISSIONS] } }],
  disposeOnTenantChange: true, stores: [{ key: 'peanut.integration-security.runtime', dispose: runtime.dispose }],
})
