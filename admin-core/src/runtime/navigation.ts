import type { ApiAudience } from '../api/client'
import type { AdminModuleContribution } from '../module/contribution'
import { defineAdminModule } from '../module/contribution'

export interface AdminNavigationRoute {
  name: string
  path: string
  audience: ApiAudience
  permission?: string
  permissionKeys?: readonly string[]
  moduleKey?: string
}

export interface AdminNavigationMenuInput {
  route_name?: unknown
  route_path?: unknown
  component?: unknown
}

export interface AdminNavigationRegistry {
  resolveMenu: (menu: AdminNavigationMenuInput) => AdminNavigationRoute | null
  diagnostics: () => readonly string[]
  clearDiagnostics: () => void
  routes: () => readonly AdminNavigationRoute[]
  disposeTenantState: () => Promise<void>
}

export interface AdminNavigationRegistryInput {
  routes: readonly AdminNavigationRoute[]
  modules: readonly AdminModuleContribution[]
}

const throwRegistryConflict = (name: string): never => {
  throw new Error(`ADMIN_ROUTE_REGISTRY_CONFLICT: ${name}`)
}

const matchesAudience = (route: AdminNavigationRoute): boolean => route.audience === 'tenant'
  ? route.path === '/app' || route.path.startsWith('/app/')
  : route.path === '/platform' || route.path.startsWith('/platform/')

const runDisposers = async (disposers: readonly (() => void | Promise<void>)[]): Promise<void> => {
  const results = await Promise.allSettled(disposers.map(async dispose => dispose()))
  const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')
  if (failure !== undefined) throw failure.reason
}

export const createAdminNavigationRegistry = (
  input: AdminNavigationRegistryInput,
): AdminNavigationRegistry => {
  const routeMap = new Map<string, AdminNavigationRoute>()
  const paths = new Set<string>()
  const moduleKeys = new Set<string>()
  const tenantDisposers: Array<() => void | Promise<void>> = []

  const registerRoute = (route: AdminNavigationRoute): void => {
    if (route.name === ''
      || !matchesAudience(route)
      || routeMap.has(route.name)
      || paths.has(route.path)) {
      throwRegistryConflict(route.name)
    }
    routeMap.set(route.name, {
      ...route,
      ...(route.permissionKeys === undefined ? {} : { permissionKeys: [...route.permissionKeys] }),
    })
    paths.add(route.path)
  }

  for (const route of input.routes) registerRoute(route)
  for (const rawModule of input.modules) {
    const module = defineAdminModule(rawModule)
    if (moduleKeys.has(module.key)) throwRegistryConflict(module.key)
    moduleKeys.add(module.key)
    for (const route of module.routes) {
      registerRoute({
        name: route.name,
        path: route.path,
        audience: 'tenant',
        moduleKey: module.key,
        permissionKeys: route.access.permissionKeys,
      })
    }
    if (module.disposeOnTenantChange) {
      tenantDisposers.push(...(module.stores ?? []).map(store => store.dispose))
    }
  }

  const unknownRoutes = new Set<string>()

  return {
    resolveMenu(menu) {
      if (typeof menu.route_name !== 'string') return null
      const route = routeMap.get(menu.route_name)
      if (route === undefined) {
        unknownRoutes.add(menu.route_name)
        return null
      }
      return route
    },
    diagnostics: () => [...unknownRoutes],
    clearDiagnostics: () => unknownRoutes.clear(),
    routes: () => [...routeMap.values()],
    disposeTenantState: () => runDisposers(tenantDisposers),
  }
}
