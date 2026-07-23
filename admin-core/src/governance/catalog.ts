import type {
  GovernanceAudience,
  GovernanceCatalog,
  GovernanceCatalogInput,
  GovernancePermissionDefinition,
} from './types'

const permissionPattern = /^[a-z][a-z0-9]*(?:[.-][a-z][a-z0-9-]*)+$/
const modulePattern = /^[a-z][a-z0-9]*(?:[.-][a-z][a-z0-9-]*)*$/

const fail = (code: string): never => { throw new Error(code) }

const routePathMatches = (audience: GovernanceAudience, path: string): boolean => {
  const prefix = audience === 'tenant' ? '/app' : '/platform'
  return (path === prefix || path.startsWith(`${prefix}/`))
    && !path.startsWith('//')
    && !/[\\\u0000-\u001f\u007f]/.test(path)
}

export const createGovernanceCatalog = (input: GovernanceCatalogInput): GovernanceCatalog => {
  const permissions = new Map<string, GovernancePermissionDefinition>()
  for (const permission of input.permissions) {
    if (!permissionPattern.test(permission.key)
      || !modulePattern.test(permission.moduleKey)
      || (permission.audience === 'platform') !== permission.key.startsWith('platform.')
      || permissions.has(permission.key)) fail('GOVERNANCE_PERMISSION_INVALID')
    permissions.set(permission.key, { ...permission })
  }

  const routes = new Map<string, GovernanceCatalogInput['routes'][number]>()
  const paths = new Set<string>()
  for (const route of input.routes) {
    if (route.name === ''
      || !routePathMatches(route.audience, route.path)
      || routes.has(route.name)
      || paths.has(route.path)) fail('GOVERNANCE_ROUTE_INVALID')
    for (const permissionKey of route.permissionKeys) {
      const permission = permissions.get(permissionKey) ?? fail('GOVERNANCE_PERMISSION_UNDECLARED')
      if (permission.audience !== route.audience) fail('GOVERNANCE_PERMISSION_AUDIENCE_MISMATCH')
    }
    routes.set(route.name, { ...route, permissionKeys: [...route.permissionKeys] })
    paths.add(route.path)
  }

  const icons = new Map<string, GovernanceCatalogInput['icons'][string]>()
  for (const [key, icon] of Object.entries(input.icons)) {
    if (!/^[A-Z][A-Za-z0-9]{0,63}$/.test(key)
      || icon.label.trim() === ''
      || icon.glyph.trim() === ''
      || icons.has(key)) fail('GOVERNANCE_ICON_INVALID')
    icons.set(key, { ...icon })
  }

  return { permissions, routes, icons }
}

export const requireGovernancePermission = (
  catalog: GovernanceCatalog,
  key: string,
  audience: GovernanceAudience,
): GovernancePermissionDefinition => {
  const permission = catalog.permissions.get(key) ?? fail('GOVERNANCE_PERMISSION_UNDECLARED')
  if (permission.audience !== audience) fail('GOVERNANCE_PERMISSION_AUDIENCE_MISMATCH')
  if (!permission.active) fail('GOVERNANCE_PERMISSION_INACTIVE')
  return permission
}
