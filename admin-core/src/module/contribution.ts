import type { Component } from 'vue'

export interface AdminRouteAccess {
  moduleKey: string
  permissionKeys: readonly string[]
}

export interface AdminModuleRoute {
  name: string
  path: string
  component: () => Promise<{ default: Component }>
  access: AdminRouteAccess
}

export interface AdminModuleStoreContribution {
  key: string
  dispose: () => void | Promise<void>
}

export interface AdminModuleLocaleContribution {
  locale: string
  load: () => Promise<Readonly<Record<string, string>>>
}

export type AdminModuleShellSlotName = 'header-context' | 'header-actions' | 'sidebar-footer' | 'page-tools'

export interface AdminModuleShellSlotContribution {
  name: AdminModuleShellSlotName
  component: () => Promise<{ default: Component }>
  access?: AdminRouteAccess
}

export interface AdminModuleContribution {
  key: string
  routes: readonly AdminModuleRoute[]
  disposeOnTenantChange: boolean
  stores?: readonly AdminModuleStoreContribution[]
  locales?: readonly AdminModuleLocaleContribution[]
  shellSlots?: readonly AdminModuleShellSlotContribution[]
}

const moduleKeyPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*)*$/
const routeNamePattern = /^[a-z][a-z0-9]*(?:[.-][a-z][a-z0-9]*)+$/

export const defineAdminModule = <T extends AdminModuleContribution>(contribution: T): T => {
  if (!moduleKeyPattern.test(contribution.key)) {
    throw new Error(`ADMIN_MODULE_KEY_INVALID: ${contribution.key}`)
  }
  const names = new Set<string>()
  const paths = new Set<string>()
  for (const route of contribution.routes) {
    if (!routeNamePattern.test(route.name) || names.has(route.name)) {
      throw new Error(`ADMIN_MODULE_ROUTE_NAME_INVALID: ${route.name}`)
    }
    if (!route.path.startsWith('/app/') || paths.has(route.path)) {
      throw new Error(`ADMIN_MODULE_ROUTE_PATH_INVALID: ${route.path}`)
    }
    if (route.access.moduleKey !== contribution.key || route.access.permissionKeys.length === 0) {
      throw new Error(`ADMIN_MODULE_ROUTE_ACCESS_INVALID: ${route.name}`)
    }
    names.add(route.name)
    paths.add(route.path)
  }
  const storeKeys = new Set<string>()
  for (const store of contribution.stores ?? []) {
    if (!store.key.startsWith(`${contribution.key}.`) || storeKeys.has(store.key)) {
      throw new Error(`ADMIN_MODULE_STORE_INVALID: ${store.key}`)
    }
    storeKeys.add(store.key)
  }
  const locales = new Set<string>()
  for (const locale of contribution.locales ?? []) {
    if (!/^[a-z]{2}(?:-[A-Z]{2})?$/.test(locale.locale) || locales.has(locale.locale)) {
      throw new Error(`ADMIN_MODULE_LOCALE_INVALID: ${locale.locale}`)
    }
    locales.add(locale.locale)
  }
  const slots = new Set<AdminModuleShellSlotName>()
  for (const slot of contribution.shellSlots ?? []) {
    if (slots.has(slot.name) || (slot.access !== undefined && slot.access.moduleKey !== contribution.key)) {
      throw new Error(`ADMIN_MODULE_SHELL_SLOT_INVALID: ${slot.name}`)
    }
    slots.add(slot.name)
  }

  return contribution
}

export interface MenuRouteRegistry {
  resolve: (routeName: string) => AdminModuleRoute | null
  diagnostics: () => readonly string[]
  routes: () => readonly AdminModuleRoute[]
}

export const createMenuRouteRegistry = (
  contributions: readonly AdminModuleContribution[],
): MenuRouteRegistry => {
  const routeMap = new Map<string, AdminModuleRoute>()
  const paths = new Set<string>()
  for (const rawContribution of contributions) {
    const contribution = defineAdminModule(rawContribution)
    for (const route of contribution.routes) {
      if (routeMap.has(route.name) || paths.has(route.path)) {
        throw new Error(`ADMIN_ROUTE_REGISTRY_CONFLICT: ${route.name}`)
      }
      routeMap.set(route.name, route)
      paths.add(route.path)
    }
  }
  const unknownRoutes = new Set<string>()

  return {
    resolve(routeName) {
      const route = routeMap.get(routeName)
      if (route === undefined) {
        unknownRoutes.add(routeName)
        return null
      }
      return route
    },
    diagnostics: () => [...unknownRoutes],
    routes: () => [...routeMap.values()],
  }
}
