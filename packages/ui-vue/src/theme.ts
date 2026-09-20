export const SHELL_THEME_TOKENS = {
  headerHeight: '--pa-shell-header-height',
  sidebarWidth: '--pa-shell-sidebar-width',
  sidebarCollapsedWidth: '--pa-shell-sidebar-collapsed-width',
  contentMaxWidth: '--pa-shell-content-max-width',
  surfaceColor: '--pa-shell-surface-color',
  borderColor: '--pa-shell-border-color',
  textColor: '--pa-shell-text-color',
  mutedTextColor: '--pa-shell-muted-text-color',
  focusColor: '--pa-shell-focus-color',
} as const

export type ShellThemeToken = typeof SHELL_THEME_TOKENS[keyof typeof SHELL_THEME_TOKENS]

export type ShellSlotName = 'header' | 'sidebar' | 'breadcrumb' | 'tabs' | 'default'
