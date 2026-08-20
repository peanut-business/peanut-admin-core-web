export const ADMIN_SHELL_PACKAGE = '@peanut-admin/admin/shell' as const
export const ADMIN_SHELL_VERSION = '0.1.0' as const

export { defineShellHostConfig } from './config'
export type { ShellHostConfig, ShellHostConfigInput } from './config'
export {
  AdminShell,
  PageContent,
  PageHeader,
  PageToolbar,
  PlatformShell,
  ShellBreadcrumb,
  ShellHeader,
  ShellSidebar,
  ShellTabs,
} from './layout'
export type { ShellBreadcrumbItem, ShellIdentity, ShellNavigationItem } from './layout'
export {
  ConflictState,
  EmptyState,
  ForbiddenState,
  ModuleUnavailableState,
  NotFoundState,
  RateLimitState,
  ServiceUnavailableState,
  SessionExpiredState,
} from './states'
export { TargetScopeSummary, TargetSelector } from './targets'
export type { TargetScopeMode } from './targets'
export { SHELL_THEME_TOKENS } from './theme'
export type { ShellSlotName, ShellThemeToken } from './theme'
export { allowsInstanceTools, deploymentMode, routesForDeployment } from './deployment-mode'
export type { DeploymentMode, DeploymentRoute } from './deployment-mode'
export { tabFromRoute } from './tabs'
export type { ShellTab, ShellTabRoute, ShellTabState } from './tabs'
export {
  ADMIN_SHELL_OVERRIDE_SLOTS,
  resolveWorkspaceShell,
  WORKSPACE_SHELL_OVERRIDE_KEY,
} from './overrides'
export type {
  AdminShellOverrideRegistry,
  WorkspaceShellResolver,
} from './overrides'
