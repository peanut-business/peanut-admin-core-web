export const ADMIN_SHELL_PACKAGE = '@peanut-admin/admin-shell' as const
export const ADMIN_SHELL_VERSION = '0.1.0' as const

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
export {
  EmptyState,
  ForbiddenState,
  ModuleUnavailableState,
  SessionExpiredState,
} from './states'
export { TargetScopeSummary, TargetSelector } from './targets'
export type { TargetScopeMode } from './targets'
export { SHELL_THEME_TOKENS } from './theme'
export type { ShellSlotName, ShellThemeToken } from './theme'
