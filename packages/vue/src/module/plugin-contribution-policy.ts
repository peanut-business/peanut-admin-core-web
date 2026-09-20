import type { PermissionEvaluator } from '../access/permission-policy'
import { evaluateRequiredPermissions } from '../access/permission-policy'

/**
 * Minimal router contract shared by host applications without coupling to a
 * particular Vue Router major version.
 */
export interface PluginFrontendRoute {
  path: string
  name?: unknown
  component?: unknown
  meta?: {
    requiredPermissions?: string | string[]
    [key: string]: unknown
  }
  children?: PluginFrontendRoute[]
}

export interface PluginFrontendContribution<T extends PluginFrontendRoute = PluginFrontendRoute> {
  moduleKey: string
  routes: T[]
}

export const collectPluginContributions = (
  modules: Record<string, { default?: PluginFrontendContribution }>,
): PluginFrontendContribution[] => Object.keys(modules)
  .sort()
  .map(path => modules[path]?.default)
  .filter((contribution): contribution is PluginFrontendContribution => (
    typeof contribution?.moduleKey === 'string'
      && contribution.moduleKey.length > 0
      && Array.isArray(contribution.routes)
  ))

/** Deployment presence alone never exposes a Tenant Module route. */
export const routesForTenantModules = <T extends PluginFrontendRoute>(
  contributions: PluginFrontendContribution<T>[],
  enabledModules: readonly string[],
  grantedPermissions: readonly string[],
  evaluator: PermissionEvaluator,
): T[] => {
  const enabled = new Set(enabledModules)
  return contributions.flatMap((contribution) => {
    if (!enabled.has(contribution.moduleKey)) return []
    return contribution.routes.filter((route) => {
      const required = route.meta?.requiredPermissions
      return (typeof required === 'string' || Array.isArray(required))
        && evaluateRequiredPermissions(required, grantedPermissions, evaluator)
    })
  })
}
