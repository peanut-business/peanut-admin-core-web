import type { ApiAudience } from '../api/client'

export interface AdminRouteGuardInput {
  audience: ApiAudience
  moduleKey?: string
  permissionKeys?: readonly string[]
}

export interface AdminRouteGuardDependencies {
  enterAudience: (audience: ApiAudience) => Promise<void>
  ensureContext: (audience: ApiAudience) => Promise<void>
  loadNavigation: (audience: ApiAudience) => Promise<void>
  hasModule: (moduleKey: string) => boolean
  hasPermissions: (permissionKeys: readonly string[]) => boolean
}

export type AdminRouteGuardResult =
  | { status: 'allowed' }
  | { status: 'module-unavailable', code: 'MODULE_TENANT_DISABLED' }
  | { status: 'forbidden', code: 'AUTHZ_FUNCTIONAL_DENIED' }

export const runAdminRouteGuard = async (
  route: AdminRouteGuardInput,
  dependencies: AdminRouteGuardDependencies,
): Promise<AdminRouteGuardResult> => {
  await dependencies.enterAudience(route.audience)
  await dependencies.ensureContext(route.audience)
  await dependencies.loadNavigation(route.audience)

  if (route.moduleKey !== undefined && !dependencies.hasModule(route.moduleKey)) {
    return { status: 'module-unavailable', code: 'MODULE_TENANT_DISABLED' }
  }
  if (route.permissionKeys !== undefined
    && route.permissionKeys.length > 0
    && !dependencies.hasPermissions(route.permissionKeys)) {
    return { status: 'forbidden', code: 'AUTHZ_FUNCTIONAL_DENIED' }
  }

  return { status: 'allowed' }
}
