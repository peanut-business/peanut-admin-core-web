export type GovernanceAudience = 'tenant' | 'platform'

export interface GovernancePermissionDefinition {
  key: string
  moduleKey: string
  audience: GovernanceAudience
  active: boolean
}

export interface GovernanceRouteDefinition {
  name: string
  path: string
  audience: GovernanceAudience
  moduleKey?: string
  permissionKeys: readonly string[]
}

export interface GovernanceIconDefinition {
  label: string
  glyph: string
}

export interface GovernanceCatalog {
  permissions: ReadonlyMap<string, GovernancePermissionDefinition>
  routes: ReadonlyMap<string, GovernanceRouteDefinition>
  icons: ReadonlyMap<string, GovernanceIconDefinition>
}

export interface GovernanceCatalogInput {
  permissions: readonly GovernancePermissionDefinition[]
  routes: readonly GovernanceRouteDefinition[]
  icons: Readonly<Record<string, GovernanceIconDefinition>>
}

export interface GovernanceMenuInput {
  key: string
  type: 'group' | 'page' | 'link'
  routeName: string | null
  routePath: string | null
  requiredPermission: string | null
  moduleKey: string
  icon: string | null
}

export interface GovernanceVisibilityContext {
  audience: GovernanceAudience
  deploymentModules: ReadonlySet<string>
  tenantModules: ReadonlySet<string>
  permissions: ReadonlySet<string>
}

export interface GovernanceMenuExplanation {
  key: string
  visible: boolean
  reason: string
  trustedPath: string | null
  icon: GovernanceIconDefinition | null
}
