export const ADMIN_CORE_PACKAGE = '@peanut-admin/admin/core' as const
export const ADMIN_CORE_VERSION = '0.1.0' as const

export { createPlatformApiClient, createProtectedFetch, createTenantApiClient } from './api/client'
export type {
  ApiAudience,
  AudienceApiClient,
  AudienceApiClientOptions,
  ProtectedFetchOptions,
} from './api/client'
export { createBrowserRefreshCoordinator, createMemoryRefreshCoordinator } from './api/refresh'
export type { RefreshAttempt, RefreshCoordinator } from './api/refresh'
export { isProblemCode, parseProblemDetails } from './api/problem'
export type { ProblemDetails, ProblemFieldError } from './api/problem'
export { hasAllPermissions, hasPermission, useAccess } from './access/access'
export type { AccessHints } from './access/access'
export {
  usePlatformAuth,
  usePlatformContext,
  useTenantAuth,
  useTenantContext,
} from './auth/stores'
export type { PlatformContextData, TenantContextData } from './auth/stores'
export { disposeTenantState, registerTenantDisposer } from './lifecycle/tenant'
export { createTenantLifecycle } from './lifecycle/tenant'
export type { TenantDisposer, TenantLifecycle, TenantLifecycleTicket } from './lifecycle/tenant'
export { createMenuRouteRegistry, defineAdminModule } from './module/contribution'
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
export { useOperationTargets } from './targets/store'
export type {
  OperationTargetScope,
  TargetCardinality,
  TargetCandidate,
  TypedTarget,
  TypedTargetSet,
} from './targets/store'
export type { components, operations, paths } from './generated/api'
export {
  createDataPolicyDraft,
  createGovernanceCatalog,
  createRolePermissionDraft,
  explainMenuVisibility,
  normalizeAuditFilter,
  projectAuditDetail,
  requireGovernancePermission,
  requireRevision,
} from './governance/index'
export type {
  GovernanceAuditDetailInput,
  GovernanceAuditFilter,
  GovernanceAuditOutcome,
  GovernanceAudience,
  GovernanceCatalog,
  GovernanceCatalogInput,
  GovernanceIconDefinition,
  GovernanceMenuExplanation,
  GovernanceMenuInput,
  GovernancePermissionDefinition,
  GovernanceRouteDefinition,
  GovernanceVisibilityContext,
  CreateDataPolicyDraftInput,
  DataPolicyDraftInput,
  RolePermissionDraftInput,
  UpdateDataPolicyDraftInput,
} from './governance/index'
