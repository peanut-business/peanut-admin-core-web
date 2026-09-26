export const PEANUT_ADMIN_VUE_PACKAGE = "@peanut-admin/vue" as const;
export const PEANUT_ADMIN_VUE_VERSION = "4.0.0-dev.1" as const;

export type { ApiAudience } from "./api/audience.js";
export {
  createBrowserRefreshCoordinator,
  createMemoryRefreshCoordinator,
} from "./api/refresh.js";
export type { RefreshAttempt, RefreshCoordinator } from "./api/refresh.js";
export { isProblemCode, parseProblemDetails } from "./api/problem.js";
export type { ProblemDetails, ProblemFieldError } from "./api/problem.js";
export {
  hasAllPermissions,
  hasPermission,
  useAccess,
} from "./access/access.js";
export type { AccessHints } from "./access/access.js";
export {
  evaluateRequiredPermissions,
  permissionEvaluatorSlot,
  PERMISSION_EVALUATOR_OVERRIDE_KEY,
} from "./access/permission-policy.js";
export type { PermissionEvaluator } from "./access/permission-policy.js";
export {
  usePlatformAuth,
  usePlatformContext,
  useTenantAuth,
  useTenantContext,
} from "./auth/stores.js";
export type { PlatformContextData, TenantContextData } from "./auth/stores.js";
export {
  isMultiTenantDeployment,
  isTenantAccessToken,
} from "./auth/tenant-session.js";
export type {
  TenantAuthentication,
  TenantChoice,
  TenantSelection,
  TenantSessionOutcome,
} from "./auth/tenant-session.js";
export {
  disposeTenantState,
  registerTenantDisposer,
} from "./lifecycle/tenant.js";
export { createTenantLifecycle } from "./lifecycle/tenant.js";
export type {
  TenantDisposer,
  TenantLifecycle,
  TenantLifecycleTicket,
} from "./lifecycle/tenant.js";
export { useAsyncAction, useAsyncList } from "./data/async-state.js";
export type {
  AsyncActionResult,
  AsyncActionState,
  AsyncListOptions,
  AsyncListPage,
  AsyncListPagination,
  AsyncListQuery,
  AsyncListState,
} from "./data/async-state.js";
export {
  createMenuRouteRegistry,
  defineAdminModule,
} from "./module/contribution.js";
export {
  collectPluginContributions,
  routesForTenantModules,
} from "./module/plugin-contribution-policy.js";
export { enabledTenantModulesFromRoutes } from "./module/tenant-modules.js";
export type {
  AdminModuleContribution,
  AdminModuleLocaleContribution,
  AdminModuleRoute,
  AdminModuleShellSlotContribution,
  AdminModuleShellSlotName,
  AdminModuleStoreContribution,
  AdminRouteAccess,
  MenuRouteRegistry,
} from "./module/contribution.js";
export type {
  PluginFrontendContribution,
  PluginFrontendRoute,
} from "./module/plugin-contribution-policy.js";
export type { TenantModuleRoute } from "./module/tenant-modules.js";
export { defineAdminHostConfig } from "./runtime/config.js";
export type {
  AdminAudienceHostConfig,
  AdminHostConfig,
} from "./runtime/config.js";
export { mapAdminRuntimeError } from "./runtime/errors.js";
export type {
  AdminRuntimeErrorKind,
  AdminRuntimeErrorState,
} from "./runtime/errors.js";
export { runAdminRouteGuard } from "./runtime/guard.js";
export type {
  AdminRouteGuardDependencies,
  AdminRouteGuardInput,
  AdminRouteGuardResult,
} from "./runtime/guard.js";
export { createAdminNavigationRegistry } from "./runtime/navigation.js";
export type {
  AdminNavigationMenuInput,
  AdminNavigationRegistry,
  AdminNavigationRegistryInput,
  AdminNavigationRoute,
} from "./runtime/navigation.js";
export {
  createAdminOverrideRegistry,
  defineAdminOverrideSlot,
} from "./runtime/overrides.js";
export type {
  AdminOverride,
  AdminOverrideKind,
  AdminOverrideRegistry,
  AdminOverrideRegistryInput,
  AdminOverrideResolution,
  AdminOverrideResolutionMetadata,
  AdminOverrideSlot,
  AdminOverrideSource,
} from "./runtime/overrides.js";
export { useOperationTargets } from "./targets/store.js";
export type {
  OperationTargetScope,
  TargetCardinality,
  TargetCandidate,
  TypedTarget,
  TypedTargetSet,
} from "./targets/store.js";
