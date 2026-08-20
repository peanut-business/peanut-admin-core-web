/** Minimal route shape needed to derive Tenant module availability. */
export interface TenantModuleRoute {
  meta?: {
    tenantModuleKey?: unknown
  }
  children?: readonly TenantModuleRoute[]
}

/**
 * Derive the distinct Tenant module keys exposed by a server-authorized route
 * tree. The host owns fetching and route-to-component resolution.
 */
export const enabledTenantModulesFromRoutes = (
  routes: readonly TenantModuleRoute[],
): string[] => Array.from(new Set(
  routes
    .flatMap(route => [route, ...(route.children ?? [])])
    .map(route => route.meta?.tenantModuleKey)
    .filter((key): key is string => typeof key === 'string'),
))
