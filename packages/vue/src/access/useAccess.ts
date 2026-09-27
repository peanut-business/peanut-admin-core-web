import { usePlatformContext, useTenantContext } from '../auth/stores.js';
import type { ApiAudience } from '../api/audience.js';
import { hasAllPermissions, hasPermission } from './access.js';

export interface AccessHints {
  can: (permission: string) => boolean;
  canAll: (permissions: readonly string[]) => boolean;
}

/** UI hints read the current context; backend authorization remains authoritative. */
export const useAccess = (audience: ApiAudience = 'tenant'): AccessHints => {
  const context =
    audience === 'tenant' ? useTenantContext() : usePlatformContext();

  return {
    can: (permission) => hasPermission(context.permissionSet, permission),
    canAll: (required) => hasAllPermissions(context.permissionSet, required),
  };
};
