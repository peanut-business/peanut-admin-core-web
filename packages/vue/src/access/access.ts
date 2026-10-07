/** Checks one exact key; `*` is a grant marker, not a permission to query. */
export const hasPermission = (
  permissions: ReadonlySet<string>,
  permission: string
): boolean => permission !== '*' && permissions.has(permission);

/** Requires every key; use the policy evaluator for any-of checks. */
export const hasAllPermissions = (
  permissions: ReadonlySet<string>,
  required: readonly string[]
): boolean =>
  required.every((permission) => hasPermission(permissions, permission));
