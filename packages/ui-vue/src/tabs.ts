/** Framework-neutral route data required by an admin workspace tab. */
export interface ShellTabRoute {
  name: unknown;
  fullPath: string;
  query?: unknown;
  meta?: {
    locale?: string;
    ignoreCache?: boolean | undefined;
    fullPathKey?: boolean;
  };
}

export interface ShellTab {
  key?: string;
  title: string;
  name: string;
  fullPath: string;
  query?: unknown;
  ignoreCache?: boolean | undefined;
}

/** Keep tab identity separate from the complete URL used for navigation. */
export const getTabKey = (tab: ShellTabRoute | ShellTab): string => {
  if ('key' in tab && tab.key) return tab.key;
  return 'meta' in tab && tab.meta?.fullPathKey === false
    ? tab.fullPath.split(/[?#]/, 1)[0]
    : tab.fullPath;
};

export interface ShellTabState {
  tagList: ShellTab[];
  cacheTabList: Set<string>;
}

export const tabFromRoute = (route: ShellTabRoute): ShellTab => ({
  key: getTabKey(route),
  title: route.meta?.locale || '',
  name: String(route.name),
  fullPath: route.fullPath,
  query: route.query,
  ignoreCache: route.meta?.ignoreCache,
});
