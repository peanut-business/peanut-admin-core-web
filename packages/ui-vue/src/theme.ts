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
  hoverColor: '--pa-shell-hover-color',
  activeColor: '--pa-shell-active-color',
  activeTextColor: '--pa-shell-active-text-color',
  spacing: '--pa-shell-spacing',
  gap: '--pa-shell-gap',
  fontFamily: '--pa-shell-font-family',
  fontSize: '--pa-shell-font-size',
  lineHeight: '--pa-shell-line-height',
  motionDuration: '--pa-shell-motion-duration',
} as const;

export type ShellThemeToken =
  (typeof SHELL_THEME_TOKENS)[keyof typeof SHELL_THEME_TOKENS];

export type ShellSlotName =
  | 'header'
  | 'sidebar'
  | 'breadcrumb'
  | 'tabs'
  | 'header-context'
  | 'header-actions'
  | 'sidebar-footer'
  | 'page-tools'
  | 'navigation-icon'
  | 'default';

export type ShellThemeMode = 'light' | 'dark';
export type ShellDensity = 'comfortable' | 'compact';
export type ShellLayout = 'admin' | 'workspace';
export type ShellNavigationMode = 'tree' | 'grouped' | 'top';

/** Trusted application presentation values, never identity or authorization. */
export interface ShellThemeInput {
  mode?: ShellThemeMode;
  density?: ShellDensity;
  colors?: Partial<{
    primary: string;
    success: string;
    warning: string;
    danger: string;
    info: string;
    background: string;
    surface: string;
    text: string;
    mutedText: string;
    border: string;
  }>;
  typography?: {
    fontFamily?: string;
    fontSize?: string;
    lineHeight?: string;
  };
  motion?: { duration?: string };
  tokens?: Partial<Record<ShellThemeToken, string>>;
}

/** Apply to the shell (or another owning element); no document/global writes. */
export const createShellTheme = (
  input: ShellThemeInput = {}
): Readonly<Record<string, string>> => {
  const dark = input.mode === 'dark';
  const compact = input.density === 'compact';
  const colors = {
    primary: '#409eff',
    success: '#67c23a',
    warning: '#e6a23c',
    danger: '#f56c6c',
    info: '#909399',
    background: dark ? '#141414' : '#f2f3f5',
    surface: dark ? '#1d1e1f' : '#ffffff',
    text: dark ? '#e5eaf3' : '#303133',
    mutedText: dark ? '#a3a6ad' : '#909399',
    border: dark ? '#4c4d4f' : '#dcdfe6',
    ...input.colors,
  };
  // The original color tokens remain valid entry points for both shell and EP.
  colors.primary = input.tokens?.[SHELL_THEME_TOKENS.focusColor] ?? colors.primary;
  colors.surface = input.tokens?.[SHELL_THEME_TOKENS.surfaceColor] ?? colors.surface;
  colors.text = input.tokens?.[SHELL_THEME_TOKENS.textColor] ?? colors.text;
  colors.mutedText = input.tokens?.[SHELL_THEME_TOKENS.mutedTextColor] ?? colors.mutedText;
  colors.border = input.tokens?.[SHELL_THEME_TOKENS.borderColor] ?? colors.border;
  const mix = (color: string, amount: number, target = colors.surface) =>
    `color-mix(in srgb, ${color} ${100 - amount}%, ${target})`;
  const fontFamily = input.typography?.fontFamily ??
    'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const fontSize = input.typography?.fontSize ?? (compact ? '13px' : '14px');
  const duration = input.motion?.duration ?? '0.2s';
  const style: Record<string, string> = {
    'color-scheme': dark ? 'dark' : 'light',
    '--el-bg-color': colors.surface,
    '--el-bg-color-page': colors.background,
    '--el-bg-color-overlay': colors.surface,
    '--el-text-color-primary': colors.text,
    '--el-text-color-regular': mix(colors.text, 20),
    '--el-text-color-secondary': colors.mutedText,
    '--el-text-color-placeholder': mix(colors.mutedText, 25),
    '--el-text-color-disabled': mix(colors.mutedText, 45),
    '--el-border-color': colors.border,
    '--el-border-color-hover': colors.mutedText,
    '--el-fill-color-blank': colors.surface,
    '--el-fill-color': mix(colors.text, 92),
    '--el-fill-color-light': mix(colors.text, 96),
    '--el-fill-color-lighter': mix(colors.text, 98),
    '--el-fill-color-extra-light': mix(colors.text, 99),
    '--el-fill-color-dark': mix(colors.text, 88),
    '--el-fill-color-darker': mix(colors.text, 84),
    '--el-font-family': fontFamily,
    '--el-font-size-base': fontSize,
    '--el-component-size': compact ? '28px' : '32px',
    '--el-component-size-small': '24px',
    '--el-component-size-large': compact ? '36px' : '40px',
    '--el-transition-duration': duration,
    '--el-transition-duration-fast': `calc(${duration} * 0.5)`,
    [SHELL_THEME_TOKENS.headerHeight]: compact ? '52px' : '64px',
    [SHELL_THEME_TOKENS.sidebarWidth]: '240px',
    [SHELL_THEME_TOKENS.sidebarCollapsedWidth]: '64px',
    [SHELL_THEME_TOKENS.contentMaxWidth]: '1440px',
    [SHELL_THEME_TOKENS.surfaceColor]: 'var(--el-bg-color-overlay)',
    [SHELL_THEME_TOKENS.borderColor]: 'var(--el-border-color)',
    [SHELL_THEME_TOKENS.textColor]: 'var(--el-text-color-primary)',
    [SHELL_THEME_TOKENS.mutedTextColor]: 'var(--el-text-color-secondary)',
    [SHELL_THEME_TOKENS.focusColor]: 'var(--el-color-primary)',
    [SHELL_THEME_TOKENS.hoverColor]: 'var(--el-color-primary-light-9)',
    [SHELL_THEME_TOKENS.activeColor]: 'var(--el-color-primary-light-8)',
    [SHELL_THEME_TOKENS.activeTextColor]: 'var(--el-color-primary)',
    [SHELL_THEME_TOKENS.spacing]: compact ? '12px' : '20px',
    [SHELL_THEME_TOKENS.gap]: compact ? '8px' : '12px',
    [SHELL_THEME_TOKENS.fontFamily]: 'var(--el-font-family)',
    [SHELL_THEME_TOKENS.fontSize]: 'var(--el-font-size-base)',
    [SHELL_THEME_TOKENS.lineHeight]: input.typography?.lineHeight ?? '1.5',
    [SHELL_THEME_TOKENS.motionDuration]: 'var(--el-transition-duration)',
  };
  for (const tone of ['primary', 'success', 'warning', 'danger', 'info'] as const) {
    style[`--el-color-${tone}`] = colors[tone];
    for (let level = 1; level <= 9; level += 1) {
      style[`--el-color-${tone}-light-${level}`] = mix(colors[tone], level * 10);
    }
    style[`--el-color-${tone}-dark-2`] = mix(colors[tone], 20, dark ? '#ffffff' : '#000000');
  }
  style['--el-color-error'] = 'var(--el-color-danger)';
  for (const [suffix, amount] of [['light', 25], ['lighter', 50], ['extra-light', 75]] as const) {
    style[`--el-border-color-${suffix}`] = mix(colors.border, amount);
  }
  style['--el-border-color-dark'] = mix(colors.border, 10, colors.text);
  style['--el-border-color-darker'] = mix(colors.border, 20, colors.text);
  return Object.freeze({ ...style, ...input.tokens });
};
