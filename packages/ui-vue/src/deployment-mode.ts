export type DeploymentMode = 'standalone' | 'multi-tenant';

/**
 * Minimal router contract shared by host applications without coupling to a
 * particular Vue Router major version.
 */
export interface DeploymentRoute {
  meta?: {
    controlPlane?: unknown;
    instanceTool?: boolean;
    [key: string]: unknown;
  };
  children?: DeploymentRoute[];
}

/** Falls back to standalone when the server mode is unrecognized. */
export const deploymentMode = (value: unknown): DeploymentMode =>
  value === 'multi-tenant' ? 'multi-tenant' : 'standalone';

export const allowsInstanceTools = (value: unknown): boolean =>
  value === 'standalone';

/**
 * Excludes control-plane routes in standalone mode and instance tools when
 * disallowed.
 */
export const routesForDeployment = <T extends DeploymentRoute>(
  routes: T[],
  mode: DeploymentMode,
  instanceToolsAllowed = mode === 'standalone'
): T[] =>
  routes.reduce<T[]>((visible, route) => {
    if (mode !== 'multi-tenant' && route.meta?.controlPlane !== undefined)
      return visible;
    if (!instanceToolsAllowed && route.meta?.instanceTool === true)
      return visible;
    visible.push({
      ...route,
      children: route.children
        ? routesForDeployment(route.children, mode, instanceToolsAllowed)
        : route.children,
    } as T);
    return visible;
  }, []);
