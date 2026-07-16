import { usePlatformContext, useTenantContext } from '../auth/stores'
import type { ApiAudience } from '../api/client'

export const hasPermission = (permissions: ReadonlySet<string>, permission: string): boolean => (
  permission !== '*' && permissions.has(permission)
)

export const hasAllPermissions = (
  permissions: ReadonlySet<string>,
  required: readonly string[],
): boolean => required.every(permission => hasPermission(permissions, permission))

export interface AccessHints {
  can: (permission: string) => boolean
  canAll: (permissions: readonly string[]) => boolean
}

export const useAccess = (audience: ApiAudience = 'tenant'): AccessHints => {
  const permissions = audience === 'tenant'
    ? useTenantContext().permissionSet
    : usePlatformContext().permissionSet

  return {
    can: permission => hasPermission(permissions, permission),
    canAll: required => hasAllPermissions(permissions, required),
  }
}
