/** Framework-neutral route data required by an admin workspace tab. */
export interface ShellTabRoute {
  name: unknown
  fullPath: string
  query?: unknown
  meta?: {
    locale?: string
    ignoreCache?: boolean | undefined
  }
}

export interface ShellTab {
  title: string
  name: string
  fullPath: string
  query?: unknown
  ignoreCache?: boolean | undefined
}

export interface ShellTabState {
  tagList: ShellTab[]
  cacheTabList: Set<string>
}

export const tabFromRoute = (route: ShellTabRoute): ShellTab => ({
  title: route.meta?.locale || '',
  name: String(route.name),
  fullPath: route.fullPath,
  query: route.query,
  ignoreCache: route.meta?.ignoreCache,
})
