export const PEANUT_ADMIN_UI_VUE_PACKAGE = '@peanut-admin/ui-vue' as const;
export const PEANUT_ADMIN_UI_VUE_VERSION = '4.0.0-rc.3' as const;

export { defineShellHostConfig } from './config.js';
export type { ShellHostConfig, ShellHostConfigInput } from './config.js';
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
} from './layout.js';
export type {
  ShellBreadcrumbItem,
  ShellIdentity,
  ShellNavigationItem,
} from './layout.js';
export {
  ConflictState,
  EmptyState,
  ForbiddenState,
  ModuleUnavailableState,
  NotFoundState,
  RateLimitState,
  ServiceUnavailableState,
  SessionExpiredState,
} from './states.js';
export { TargetScopeSummary, TargetSelector } from './targets.js';
export type { TargetScopeMode } from './targets.js';
export { SHELL_THEME_TOKENS } from './theme.js';
export type { ShellSlotName, ShellThemeToken } from './theme.js';
export {
  allowsInstanceTools,
  deploymentMode,
  routesForDeployment,
} from './deployment-mode.js';
export type { DeploymentMode, DeploymentRoute } from './deployment-mode.js';
export { tabFromRoute } from './tabs.js';
export type { ShellTab, ShellTabRoute, ShellTabState } from './tabs.js';
export {
  ADMIN_SHELL_OVERRIDE_SLOTS,
  resolveWorkspaceShell,
  WORKSPACE_SHELL_OVERRIDE_KEY,
} from './overrides.js';
export type {
  AdminShellOverrideRegistry,
  WorkspaceShellResolver,
} from './overrides.js';
