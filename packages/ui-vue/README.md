# Vue UI composition

UI components consume presentation props and slots. The host owns routing,
authorized menus, identity, tenant state, data requests and command handlers.
Changing a shell, theme or navigation mode does not fetch data or grant access.

Import only the part being composed:

```ts
import { AdminShell, PageHeader, PageToolbar } from '@peanut-admin/ui-vue/layout';
import { defineShellHostConfig } from '@peanut-admin/ui-vue/config';
import { createShellTheme } from '@peanut-admin/ui-vue/theme';
```

The root barrel remains available. `/states`, `/targets`, `/tabs` and
`/overrides` are also public subpaths. `/theme` and `/config` do not import Vue
components or Element Plus. Component styles and Element Plus styles remain
the host's responsibility; these entry points do not install global CSS.

## Shell props and slots

`AdminShell` and `PlatformShell` have the same presentation contract and keep
their tenant/platform audience. `config` is produced by `defineShellHostConfig`
and contains only `brand`, audience labels and command labels. Brand is
independent of `theme`, `layout` and `navigationMode`.

| Prop | Contract |
| --- | --- |
| `identity` | `accountLabel`, `contextLabel`, `actorLabel`; no credentials |
| `navigation` | Authorized `ShellNavigationItem[]`, in host-defined order |
| `breadcrumbs` | `{ label, path: string \| null }[]` |
| `activePath` | Local path matched when `activeMenu` is empty |
| `activeMenu` | Host-selected menu key, such as `route.meta.activeMenu ?? route.name` |
| `collapsed`, `mobileOpen` | Controlled navigation state |
| `theme` | `ShellThemeInput`, default light/comfortable |
| `layout` | `admin` or `workspace`; exposes `pa-shell--layout-*` |
| `navigationMode` | `tree`, `grouped` or `top`; exposes `pa-shell--navigation-*` |

The host supplies layout/responsive CSS for the layout classes. Tree mode wraps
descendants in `.pa-shell-navigation__children`; grouped/top modes retain order
without nesting wrappers, so the host can present flat groups or a horizontal
menu. These values do not change route registration or menu visibility.

Each navigation item has `key`, `label`, `path`, `children`, and optional
`icon: string | Component`, `activeMenu: string`, `external: boolean`,
`target: '_self' | '_blank'`. A string icon is rendered as its existing CSS
class; a component is rendered directly. The `navigation-icon` slot receives
`{ item }` for hosts with an icon-name resolver. The active menu matches
`item.activeMenu ?? item.key`; the host resolves route aliases before passing it.

Local paths start with `/` and stay on the current origin. Explicit external
items accept absolute HTTP(S) URLs, preserve native browser navigation, default
to `_blank` and include `rel="noopener noreferrer"`. External links never emit
the local `navigate` event. Local modified clicks retain browser behavior.
Missing or invalid destinations render as group labels.

Events are `navigate(path)`, `update:collapsed(boolean)`,
`update:mobileOpen(boolean)`, `switch-tenant` and `logout`. The host connects them
to its existing router and commands. Permission filtering occurs before render.

The complete `header`, `sidebar`, `breadcrumb`, `tabs` and `default` slots work
with or without `config`. Four contribution slots receive `{ identity }`:

- `header-context` replaces the default identity area.
- `header-actions` adds content before the existing command buttons.
- `sidebar-footer` adds content after navigation and before its collapse control.
- `page-tools` adds content before the page body.

The module host decides which authorized contributions to pass. Replacing a
complete slot also makes the host responsible for contributions inside it.

## Theme scope and semantic tokens

`createShellTheme(input?: ShellThemeInput)` returns an immutable CSS variable
map. The built-in shells apply it on their own root and their mobile drawer;
custom components can bind it as `:style`. It never writes `document`, changes
global classes, or reads tenant/authentication state. Teleported dialogs outside
the shell must inherit the same map from their owning host or receive it on their
own container.

```ts
import type { ShellThemeInput } from '@peanut-admin/ui-vue/theme';

const newsroomTheme = {
  mode: 'dark',
  density: 'compact',
  colors: { primary: '#b89463', background: '#141719', surface: '#202528' },
  typography: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: '14px' },
  motion: { duration: '0.15s' },
  tokens: { '--pa-shell-sidebar-width': '264px' },
} satisfies ShellThemeInput;
```

The existing nine tokens keep their names:

| Shell token | Element Plus/default relationship |
| --- | --- |
| `--pa-shell-header-height` | Shell geometry: comfortable `64px`, compact `52px` |
| `--pa-shell-sidebar-width` | Shell geometry: `240px` |
| `--pa-shell-sidebar-collapsed-width` | Shell geometry: `64px` |
| `--pa-shell-content-max-width` | Shell geometry: `1440px` |
| `--pa-shell-surface-color` | `--el-bg-color-overlay` |
| `--pa-shell-border-color` | `--el-border-color` |
| `--pa-shell-text-color` | `--el-text-color-primary` |
| `--pa-shell-muted-text-color` | `--el-text-color-secondary` |
| `--pa-shell-focus-color` | `--el-color-primary` |

Geometry stays a shell concern; it has no Element Plus equivalent. Overriding an
original color token also supplies its Element Plus semantic base. Color inputs
support `primary/success/warning/danger/info/background/surface/text/mutedText/border`.
Light and dark palettes generate Element Plus tone variants with CSS `color-mix`,
including light variants for hover and `dark-2` for pressed buttons. This follows
the installed [Element Plus semantic variables](https://github.com/element-plus/element-plus/blob/2.14.3/packages/theme-chalk/src/common/var.scss)
and its [MIT license](https://github.com/element-plus/element-plus/blob/2.14.3/LICENSE);
it adds no theme dependency.

Shell hover/active/focus use `--pa-shell-hover-color`, `--pa-shell-active-color`,
`--pa-shell-active-text-color` and `--pa-shell-focus-color`. Density supplies
`--pa-shell-spacing` (`20px`/`12px`), `--pa-shell-gap` (`12px`/`8px`) and Element
Plus component sizes (`32px`/`28px` default). Typography exposes shell font family,
size and line height and maps family/size to Element Plus. Motion exposes
`--pa-shell-motion-duration` and Element Plus transition durations; use `0s` for
reduced motion. Explicit `tokens` apply last. No theme option changes layout or
brand.

For example, host CSS can consume the same semantics:

```css
.pa-shell-navigation__link:hover { background: var(--pa-shell-hover-color); }
.pa-shell-navigation__link.is-active {
  background: var(--pa-shell-active-color);
  color: var(--pa-shell-active-text-color);
}
.pa-shell-navigation__link:focus-visible {
  outline: 2px solid var(--pa-shell-focus-color);
  outline-offset: 2px;
}
.pa-shell__main { padding: var(--pa-shell-spacing); }
```

## Default and application composition

This source example defines a trusted application component locally. It uses the
same shell props, events and slots; it does not create a second runtime or data
source. Connect the resulting component to the existing host's props and handlers.
Actual host adoption and browser behavior must be confirmed by that application.

```ts
import { defineComponent, h } from 'vue';
import { createAdminOverrideRegistry } from '@peanut-admin/vue';
import { AdminShell, PlatformShell } from '@peanut-admin/ui-vue/layout';
import {
  ADMIN_SHELL_OVERRIDE_SLOTS,
  resolveWorkspaceShell,
  WORKSPACE_SHELL_OVERRIDE_KEY,
} from '@peanut-admin/ui-vue/overrides';

const NewsroomShell = defineComponent({
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => h(AdminShell, {
      ...attrs,
      layout: 'workspace',
      navigationMode: 'grouped',
      theme: { colors: { primary: '#926b41' }, density: 'compact' },
    }, slots);
  },
});

const defaults = createAdminOverrideRegistry({ slots: ADMIN_SHELL_OVERRIDE_SLOTS });
const defaultShell = resolveWorkspaceShell(defaults, 'tenant'); // AdminShell

const customized = createAdminOverrideRegistry({
  slots: ADMIN_SHELL_OVERRIDE_SLOTS,
  presets: [{
    key: WORKSPACE_SHELL_OVERRIDE_KEY,
    kind: 'service',
    contractVersion: '1.0.0',
    value: (audience: 'tenant' | 'platform') =>
      audience === 'tenant' ? NewsroomShell : PlatformShell,
  }],
  overrides: [], // Explicit application entries take precedence over presets.
});
const customShell = resolveWorkspaceShell(customized, 'tenant'); // NewsroomShell
```

The existing `AdminOverrideRegistry` resolves official defaults → selected preset
entries → explicit application entries. `diagnostics()` reports
`default | preset | application`. Duplicate entries within one layer still fail;
the application may replace a preset for the same registered key. Both layers
use the same key/kind/version/value validation. Unknown keys throw
`ADMIN_OVERRIDE_KEY_UNKNOWN`; resolving an unregistered key throws
`ADMIN_OVERRIDE_SLOT_UNKNOWN`. A resolver returning a non-component throws
`ADMIN_SHELL_OVERRIDE_RESULT_INVALID`. These failures remain observable; do not
catch them and silently choose a default shell.
