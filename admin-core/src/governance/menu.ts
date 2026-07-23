import { requireGovernancePermission } from './catalog'
import type {
  GovernanceCatalog,
  GovernanceMenuExplanation,
  GovernanceMenuInput,
  GovernanceVisibilityContext,
} from './types'

const fail = (code: string): never => { throw new Error(code) }

export const explainMenuVisibility = (
  menu: GovernanceMenuInput,
  context: GovernanceVisibilityContext,
  catalog: GovernanceCatalog,
): GovernanceMenuExplanation => {
  const route = menu.routeName === null ? null : catalog.routes.get(menu.routeName)
  if (menu.type === 'page' && route === undefined) fail('GOVERNANCE_ROUTE_UNDECLARED')
  if (route !== null && route !== undefined) {
    if (route.audience !== context.audience) fail('GOVERNANCE_ROUTE_AUDIENCE_MISMATCH')
    const expectedModule = menu.moduleKey === 'core' ? undefined : menu.moduleKey
    if (route.moduleKey !== expectedModule) fail('GOVERNANCE_ROUTE_MODULE_MISMATCH')
  }

  const permission = menu.requiredPermission === null
    ? null
    : requireGovernancePermission(catalog, menu.requiredPermission, context.audience)
  if (route !== null && route !== undefined && permission !== null
    && !route.permissionKeys.includes(permission.key)) fail('GOVERNANCE_ROUTE_PERMISSION_MISMATCH')

  const icon = menu.icon === null ? null : catalog.icons.get(menu.icon)
  if (menu.icon !== null && icon === undefined) fail('GOVERNANCE_ICON_UNDECLARED')

  let reason = 'visible'
  if (menu.moduleKey !== 'core' && !context.deploymentModules.has(menu.moduleKey)) {
    reason = 'deployment_module_unavailable'
  } else if (menu.moduleKey !== 'core' && context.audience === 'tenant' && !context.tenantModules.has(menu.moduleKey)) {
    reason = 'tenant_module_disabled'
  } else if (permission !== null && !context.permissions.has(permission.key)) {
    reason = 'permission_not_granted'
  }

  return {
    key: menu.key,
    visible: reason === 'visible',
    reason,
    trustedPath: route?.path ?? null,
    icon: icon ?? null,
  }
}
