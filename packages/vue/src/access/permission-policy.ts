import { hasPermission } from './access'
import { defineAdminOverrideSlot } from '../runtime/overrides'

export type PermissionEvaluator = (
  permissions: ReadonlySet<string>,
  permission: string,
) => boolean

export const PERMISSION_EVALUATOR_OVERRIDE_KEY =
  'authorization.permission.service.evaluator' as const

const isPermissionEvaluator = (candidate: unknown): candidate is PermissionEvaluator => (
  typeof candidate === 'function'
)

export const permissionEvaluatorSlot = defineAdminOverrideSlot({
  key: PERMISSION_EVALUATOR_OVERRIDE_KEY,
  kind: 'service' as const,
  contractVersion: '1.0.0',
  defaultValue: hasPermission as PermissionEvaluator,
  validate: isPermissionEvaluator,
})

export const evaluateRequiredPermissions = (
  requiredPermissions: string | string[],
  grantedPermissions: readonly string[],
  evaluator: PermissionEvaluator,
): boolean => {
  const required = (Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions])
    .filter(Boolean)
  if (required.length === 0) return true

  const permissionSet = new Set(grantedPermissions)
  return permissionSet.has('*') || required.some(
    permission => permission !== '*' && evaluator(permissionSet, permission),
  )
}
