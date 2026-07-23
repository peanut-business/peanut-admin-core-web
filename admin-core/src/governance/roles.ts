import { requireGovernancePermission } from './catalog'
import type { GovernanceAudience, GovernanceCatalog } from './types'

const fail = (code: string): never => { throw new Error(code) }

const canonicalId = (value: string): string => {
  if (!/^[1-9][0-9]*$/.test(value)) fail('GOVERNANCE_ROLE_INVALID')
  return value
}

export const requireRevision = (ifMatch: string, currentRevision: number): number => {
  if (ifMatch === '') fail('PRECONDITION_REQUIRED')
  const match = /^"rev-([1-9][0-9]*)"$/.exec(ifMatch) ?? fail('PRECONDITION_INVALID')
  const revision = Number(match[1])
  if (!Number.isSafeInteger(revision) || revision !== currentRevision) fail('REVISION_MISMATCH')
  return revision
}

export interface RolePermissionChangeInput {
  audience: GovernanceAudience
  roleId: string
  currentRevision: number
  ifMatch: string
  permissionKeys: readonly string[]
  availableModules: ReadonlySet<string>
  catalog: GovernanceCatalog
}

export const prepareRolePermissionChange = (input: RolePermissionChangeInput) => {
  const keys = [...new Set(input.permissionKeys)].sort()
  for (const key of keys) {
    const permission = requireGovernancePermission(input.catalog, key, input.audience)
    if (!['core', 'platform'].includes(permission.moduleKey)
      && !input.availableModules.has(permission.moduleKey)) fail('GOVERNANCE_PERMISSION_MODULE_UNAVAILABLE')
  }
  return {
    audience: input.audience,
    roleId: canonicalId(input.roleId),
    expectedRevision: requireRevision(input.ifMatch, input.currentRevision),
    permissionKeys: keys,
  }
}

export interface GovernanceResourceOperation {
  resourceKey: string
  operation: string
  moduleKey: string
  audience: GovernanceAudience
  conditionKeys: readonly string[]
}

export interface DataPolicyChangeInput {
  audience: GovernanceAudience
  roleId: string
  currentRevision: number
  ifMatch: string
  resourceKey: string
  operation: string
  conditionKeys: readonly string[]
  availableModules: ReadonlySet<string>
  operations: readonly GovernanceResourceOperation[]
}

export const prepareDataPolicyChange = (input: DataPolicyChangeInput) => {
  if (input.audience !== 'tenant') fail('GOVERNANCE_DATA_POLICY_AUDIENCE_MISMATCH')
  const operation = input.operations.find(candidate => (
    candidate.resourceKey === input.resourceKey && candidate.operation === input.operation
  )) ?? fail('GOVERNANCE_OPERATION_UNDECLARED')
  if (operation.audience !== input.audience) fail('GOVERNANCE_OPERATION_AUDIENCE_MISMATCH')
  if (!['core', 'platform'].includes(operation.moduleKey)
    && !input.availableModules.has(operation.moduleKey)) fail('GOVERNANCE_OPERATION_MODULE_UNAVAILABLE')
  const conditionKeys = [...new Set(input.conditionKeys)].sort()
  if (conditionKeys.some(key => !operation.conditionKeys.includes(key))) fail('GOVERNANCE_CONDITION_UNDECLARED')

  return {
    roleId: canonicalId(input.roleId),
    expectedRevision: requireRevision(input.ifMatch, input.currentRevision),
    resourceKey: input.resourceKey,
    operation: input.operation,
    conditionKeys,
  }
}
