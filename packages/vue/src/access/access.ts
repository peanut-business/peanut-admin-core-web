export const hasPermission = (
  permissions: ReadonlySet<string>,
  permission: string
): boolean => permission !== '*' && permissions.has(permission);

export const hasAllPermissions = (
  permissions: ReadonlySet<string>,
  required: readonly string[]
): boolean =>
  required.every((permission) => hasPermission(permissions, permission));
