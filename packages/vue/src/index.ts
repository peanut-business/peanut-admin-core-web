export const PEANUT_ADMIN_VUE_PACKAGE = '@peanut-admin/vue' as const
export const PEANUT_ADMIN_VUE_VERSION = '4.0.0-dev.1' as const

export type { ApiAudience } from './api/audience'
export { createBrowserRefreshCoordinator, createMemoryRefreshCoordinator } from './api/refresh'
export type { RefreshAttempt, RefreshCoordinator } from './api/refresh'
export { isProblemCode, parseProblemDetails } from './api/problem'
export type { ProblemDetails, ProblemFieldError } from './api/problem'
export { hasAllPermissions, hasPermission, useAccess } from './access/access'
export type { AccessHints } from './access/access'
export {
  evaluateRequiredPermissions,
  permissionEvaluatorSlot,
  PERMISSION_EVALUATOR_OVERRIDE_KEY,
} from './access/permission-policy'
export type { PermissionEvaluator } from './access/permission-policy'
export {
  usePlatformAuth,
  usePlatformContext,
  useTenantAuth,
  useTenantContext,
} from './auth/stores'
export type { PlatformContextData, TenantContextData } from './auth/stores'
export { isMultiTenantDeployment, isTenantAccessToken } from './auth/tenant-session'
export type {
  TenantAuthentication,
  TenantChoice,
  TenantSelection,
  TenantSessionOutcome,
} from './auth/tenant-session'
export { disposeTenantState, registerTenantDisposer } from './lifecycle/tenant'
export { createTenantLifecycle } from './lifecycle/tenant'
export type { TenantDisposer, TenantLifecycle, TenantLifecycleTicket } from './lifecycle/tenant'
export { useAsyncAction, useAsyncList } from './data/async-state'
export type {
  AsyncActionResult,
  AsyncActionState,
  AsyncListOptions,
  AsyncListPage,
  AsyncListPagination,
  AsyncListQuery,
  AsyncListState,
} from './data/async-state'
export { createMenuRouteRegistry, defineAdminModule } from './module/contribution'
export { collectPluginContributions, routesForTenantModules } from './module/plugin-contribution-policy'
export { enabledTenantModulesFromRoutes } from './module/tenant-modules'
export type {
  AdminModuleContribution,
  AdminModuleLocaleContribution,
  AdminModuleRoute,
  AdminModuleShellSlotContribution,
  AdminModuleShellSlotName,
  AdminModuleStoreContribution,
  AdminRouteAccess,
  MenuRouteRegistry,
} from './module/contribution'
export type { PluginFrontendContribution, PluginFrontendRoute } from './module/plugin-contribution-policy'
export type { TenantModuleRoute } from './module/tenant-modules'
export { defineAdminHostConfig } from './runtime/config'
export type { AdminAudienceHostConfig, AdminHostConfig } from './runtime/config'
export { mapAdminRuntimeError } from './runtime/errors'
export type { AdminRuntimeErrorKind, AdminRuntimeErrorState } from './runtime/errors'
export { runAdminRouteGuard } from './runtime/guard'
export type {
  AdminRouteGuardDependencies,
  AdminRouteGuardInput,
  AdminRouteGuardResult,
} from './runtime/guard'
export { createAdminNavigationRegistry } from './runtime/navigation'
export type {
  AdminNavigationMenuInput,
  AdminNavigationRegistry,
  AdminNavigationRegistryInput,
  AdminNavigationRoute,
} from './runtime/navigation'
export {
  createAdminOverrideRegistry,
  defineAdminOverrideSlot,
} from './runtime/overrides'
export type {
  AdminOverride,
  AdminOverrideKind,
  AdminOverrideRegistry,
  AdminOverrideRegistryInput,
  AdminOverrideResolution,
  AdminOverrideResolutionMetadata,
  AdminOverrideSlot,
  AdminOverrideSource,
} from './runtime/overrides'
export { useOperationTargets } from './targets/store'
export type {
  OperationTargetScope,
  TargetCardinality,
  TargetCandidate,
  TypedTarget,
  TypedTargetSet,
} from './targets/store'
