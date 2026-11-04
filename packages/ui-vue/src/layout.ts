/* eslint-disable vue/one-component-per-file */

import { ElButton, ElDrawer } from 'element-plus';
import { computed, defineComponent, h, onBeforeUnmount, onMounted } from 'vue';
import type { Component, PropType, VNodeChild } from 'vue';

import type { ShellHostConfig } from './config.js';
import { createShellTheme } from './theme.js';
import type {
  ShellLayout,
  ShellNavigationMode,
  ShellThemeInput,
} from './theme.js';

export interface ShellIdentity {
  accountLabel: string;
  contextLabel: string;
  actorLabel: string;
}

export interface ShellNavigationItem {
  key: string;
  label: string;
  path: string | null;
  children: readonly ShellNavigationItem[];
  icon?: string | Component;
  activeMenu?: string;
  external?: boolean;
  target?: '_self' | '_blank';
}

export interface ShellBreadcrumbItem {
  label: string;
  path: string | null;
}

const shellProps = {
  config: { type: Object as PropType<ShellHostConfig>, default: null },
  identity: { type: Object as PropType<ShellIdentity>, default: null },
  navigation: {
    type: Array as PropType<readonly ShellNavigationItem[]>,
    default: () => [],
  },
  breadcrumbs: {
    type: Array as PropType<readonly ShellBreadcrumbItem[]>,
    default: () => [],
  },
  activePath: { type: String, default: '' },
  activeMenu: { type: String, default: '' },
  theme: { type: Object as PropType<ShellThemeInput>, default: () => ({}) },
  layout: { type: String as PropType<ShellLayout>, default: 'admin' },
  navigationMode: {
    type: String as PropType<ShellNavigationMode>,
    default: 'tree',
  },
  collapsed: { type: Boolean, default: false },
  mobileOpen: { type: Boolean, default: false },
  openNavigationLabel: { type: String, default: 'Open navigation' },
  collapseNavigationLabel: { type: String, default: 'Collapse navigation' },
  expandNavigationLabel: { type: String, default: 'Expand navigation' },
  primaryNavigationLabel: { type: String, default: 'Primary navigation' },
  mobileNavigationLabel: { type: String, default: 'Mobile navigation' },
  breadcrumbLabel: { type: String, default: 'Breadcrumb' },
  identityLabel: { type: String, default: 'Current identity' },
};

const shellEmits = {
  'navigate': (path: string) => typeof path === 'string',
  'update:collapsed': (collapsed: boolean) => typeof collapsed === 'boolean',
  'update:mobileOpen': (open: boolean) => typeof open === 'boolean',
  'switch-tenant': () => true,
  'logout': () => true,
};

const shellRouteOrigin = 'https://shell.invalid';

const trustedLocalPath = (path: string | null): path is string => {
  if (
    path === null ||
    !path.startsWith('/') ||
    path.startsWith('//') ||
    /[\\\u0000-\u001f\u007f]/.test(path)
  )
    return false;

  try {
    return new URL(path, shellRouteOrigin).origin === shellRouteOrigin;
  } catch {
    return false;
  }
};

const trustedExternalPath = (path: string | null): path is string => {
  if (path === null || !/^https?:\/\//i.test(path)) return false;
  try {
    const url = new URL(path);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
};

const ShellFrame = defineComponent({
  name: 'ShellFrame',
  inheritAttrs: false,
  props: {
    audience: {
      type: String as () => 'tenant' | 'platform',
      required: true,
    },
  },
  setup(props, { attrs, slots }) {
    return () =>
      h(
        'div',
        {
          ...attrs,
          'class': ['pa-shell', `pa-shell--${props.audience}`, attrs.class],
          'style': [{
            color: 'var(--pa-shell-text-color)',
            fontFamily: 'var(--pa-shell-font-family)',
            fontSize: 'var(--pa-shell-font-size)',
            lineHeight: 'var(--pa-shell-line-height)',
          }, attrs.style],
          'data-audience': props.audience,
        },
        [
          slots.header?.(),
          h('div', { class: 'pa-shell__workspace' }, [
            slots.sidebar?.(),
            h('div', { class: 'pa-shell__main' }, [
              slots.breadcrumb?.(),
              slots.tabs?.(),
              slots.default?.(),
            ]),
          ]),
        ]
      );
  },
});

const WorkspaceShell = defineComponent({
  name: 'WorkspaceShell',
  inheritAttrs: false,
  props: {
    ...shellProps,
    audience: {
      type: String as PropType<'tenant' | 'platform'>,
      required: true,
    },
  },
  emits: shellEmits,
  setup(props, { attrs, emit, slots }) {
    const themeStyle = computed(() => createShellTheme(props.theme));
    const closeMobile = () => emit('update:mobileOpen', false);
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && props.mobileOpen) closeMobile();
    };
    onMounted(() => document.addEventListener('keydown', onKeydown));
    onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown));

    const renderNavigation = (
      items: readonly ShellNavigationItem[],
      mobile: boolean
    ): VNodeChild[] =>
      items.flatMap((item) => {
        const nested = renderNavigation(item.children, mobile);
        const children =
          props.navigationMode === 'tree' && nested.length > 0
            ? [h('div', { class: 'pa-shell-navigation__children' }, nested)]
            : nested;
        const external = item.external === true;
        const canNavigate = external
          ? trustedExternalPath(item.path)
          : trustedLocalPath(item.path);
        const icon = slots['navigation-icon']?.({ item }) ??
          (typeof item.icon === 'string'
            ? h('i', { class: item.icon, 'aria-hidden': 'true' })
            : item.icon === undefined ? null : h(item.icon));
        const iconContent = icon === null ? null : h(
          'span',
          { class: 'pa-shell-navigation__icon', 'aria-hidden': 'true' },
          [icon]
        );
        if (!canNavigate) {
          return [
            h(
              'p',
              {
                class: ['pa-shell-navigation__group', 'navigation-group'],
                key: item.key,
              },
              [iconContent, h('span', item.label)]
            ),
            ...children,
          ];
        }
        const active = !external && (
          props.activeMenu !== ''
            ? props.activeMenu === (item.activeMenu ?? item.key)
            : props.activePath === item.path
        );
        return [
          h(
            'a',
            {
              'key': item.key,
              'href': item.path,
              'target': external ? item.target ?? '_blank' : undefined,
              'rel': external ? 'noopener noreferrer' : undefined,
              'class': [
                'pa-shell-navigation__link',
                'navigation-link',
                { 'is-active': active },
              ],
              'aria-current': active ? 'page' : undefined,
              'aria-label': item.label,
              'onClick': (event: MouseEvent) => {
                if (
                  external || event.button !== 0 || event.ctrlKey ||
                  event.metaKey || event.shiftKey || event.altKey
                ) return;
                event.preventDefault();
                emit('navigate', item.path as string);
                if (mobile) closeMobile();
              },
            },
            [
              h('span', {
                'class': 'navigation-marker',
                'aria-hidden': 'true',
              }),
              iconContent,
              h('span', item.label),
            ]
          ),
          ...children,
        ];
      });

    return () => {
      const frameAttrs = {
        ...attrs,
        audience: props.audience,
        class: [
          attrs.class,
          `pa-shell--layout-${props.layout}`,
          `pa-shell--navigation-${props.navigationMode}`,
        ],
        style: [themeStyle.value, attrs.style],
        'data-theme': props.theme.mode ?? 'light',
        'data-density': props.theme.density ?? 'comfortable',
      };
      if (props.config === null) {
        return h(ShellFrame, frameAttrs, slots);
      }

      const audienceLabel = props.config.audiences[props.audience].label;
      const identity = props.identity;
      const commands = [
        props.audience === 'tenant'
          ? h(
              ElButton as unknown as Component,
              {
                text: true,
                onClick: () => emit('switch-tenant'),
              },
              () => props.config?.commands.switchTenantLabel
            )
          : null,
        h(
          ElButton as unknown as Component,
          {
            text: true,
            onClick: () => emit('logout'),
          },
          () => props.config?.commands.logoutLabel
        ),
      ];
      const navigation = h(
        'nav',
        {
          'class': ['pa-shell-navigation', 'workspace-navigation'],
          'aria-label': props.primaryNavigationLabel,
        },
        renderNavigation(props.navigation, false)
      );
      const mobileNavigation = h('div', { class: 'pa-shell-mobile-content' }, [
        identity === null
          ? null
          : h(
              'div',
              {
                'class': 'pa-shell-mobile-identity',
                'aria-label': props.identityLabel,
              },
              [
                h('strong', identity.actorLabel),
                h('span', identity.contextLabel),
                h('small', identity.accountLabel),
              ]
            ),
        h(
          'nav',
          {
            'class': ['pa-shell-navigation', 'workspace-navigation'],
            'aria-label': props.mobileNavigationLabel,
          },
          renderNavigation(props.navigation, true)
        ),
        h(
          'div',
          { class: ['pa-shell-mobile-commands', 'mobile-navigation-commands'] },
          commands
        ),
      ]);

      return h(
        ShellFrame,
        frameAttrs,
        {
          header: slots.header ?? (() =>
            h(ShellHeader, {}, () => [
              h(
                'button',
                {
                  'type': 'button',
                  'class': 'mobile-nav-trigger',
                  'aria-label': props.openNavigationLabel,
                  'aria-expanded': String(props.mobileOpen),
                  'onClick': () => emit('update:mobileOpen', true),
                },
                [
                  h('span', { 'aria-hidden': 'true' }),
                  h('span', { 'aria-hidden': 'true' }),
                  h('span', { 'aria-hidden': 'true' }),
                ]
              ),
              h('div', { class: ['pa-shell-brand', 'shell-brand'] }, [
                h(
                  'span',
                  {
                    'class': ['pa-shell-brand__mark', 'brand-mark'],
                    'aria-hidden': 'true',
                  },
                  props.config?.brand.mark
                ),
                h('span', {}, [
                  h('strong', props.config?.brand.name),
                  h('small', audienceLabel),
                ]),
              ]),
              slots['header-context']?.({ identity }) ?? (identity === null
                ? null
                : h(
                    'div',
                    {
                      'class': ['pa-shell-identity', 'shell-context'],
                      'aria-label': props.identityLabel,
                    },
                    [
                      h('span', identity.contextLabel),
                      h('strong', identity.actorLabel),
                      h('small', identity.accountLabel),
                    ]
                  )),
              h(
                'div',
                { class: ['pa-shell-commands', 'shell-commands'] },
                [slots['header-actions']?.({ identity }), ...commands]
              ),
            ])),
          sidebar: slots.sidebar ?? (() =>
            h(ShellSidebar, { collapsed: props.collapsed }, () => [
              navigation,
              slots['sidebar-footer']?.({ identity }),
              h(
                'button',
                {
                  'type': 'button',
                  'class': ['pa-shell__collapse', 'sidebar-collapse'],
                  'aria-label': props.collapsed
                    ? props.expandNavigationLabel
                    : props.collapseNavigationLabel,
                  'onClick': () => emit('update:collapsed', !props.collapsed),
                },
                props.collapsed
                  ? props.expandNavigationLabel
                  : props.collapseNavigationLabel
              ),
            ])),
          breadcrumb: slots.breadcrumb ?? (() =>
            h(ShellBreadcrumb, { label: props.breadcrumbLabel }, () =>
              props.breadcrumbs.map((item, index) =>
                trustedLocalPath(item.path)
                  ? h(
                      'a',
                      {
                        key: `${index}:${item.label}`,
                        href: item.path,
                        onClick: (event: MouseEvent) => {
                          event.preventDefault();
                          emit('navigate', item.path as string);
                        },
                      },
                      item.label
                    )
                  : h(
                      'span',
                      {
                        'key': `${index}:${item.label}`,
                        'aria-current': 'page',
                      },
                      item.label
                    )
              )
            )),
          tabs: slots.tabs,
          default: () => [
            slots['page-tools']?.({ identity }),
            slots.default?.(),
            h(
              ElDrawer as unknown as Component,
              {
                'modelValue': props.mobileOpen,
                'onUpdate:modelValue': (open: boolean) =>
                  emit('update:mobileOpen', open),
                'title': props.config?.brand.name,
                'direction': 'ltr',
                'size': 'min(84vw, 320px)',
                'class': 'mobile-navigation-drawer',
                'style': themeStyle.value,
                'closeOnPressEscape': true,
              },
              () => mobileNavigation
            ),
          ],
        }
      );
    };
  },
});

const createAudienceShell = (name: string, audience: 'tenant' | 'platform') =>
  defineComponent({
    name,
    inheritAttrs: false,
    props: shellProps,
    emits: shellEmits,
    setup(props, { attrs, emit, slots }) {
      return () =>
        h(
          WorkspaceShell as Component,
          {
            ...attrs,
            ...props,
            audience,
            'onNavigate': (path: string) => emit('navigate', path),
            'onUpdate:collapsed': (collapsed: boolean) =>
              emit('update:collapsed', collapsed),
            'onUpdate:mobileOpen': (open: boolean) =>
              emit('update:mobileOpen', open),
            'onSwitchTenant': () => emit('switch-tenant'),
            'onLogout': () => emit('logout'),
          } as Record<string, unknown>,
          slots
        );
    },
  });

export const AdminShell = createAudienceShell('AdminShell', 'tenant');

export const PlatformShell = createAudienceShell('PlatformShell', 'platform');

export const ShellHeader = defineComponent({
  name: 'ShellHeader',
  setup(_, { slots }) {
    return () => h('header', { class: 'pa-shell-header' }, slots.default?.());
  },
});

export const ShellSidebar = defineComponent({
  name: 'ShellSidebar',
  props: {
    label: { type: String, default: 'Primary navigation' },
    collapsed: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    return () =>
      h(
        'aside',
        {
          'class': ['pa-shell-sidebar', { 'is-collapsed': props.collapsed }],
          'aria-label': props.label,
        },
        slots.default?.()
      );
  },
});

export const ShellBreadcrumb = defineComponent({
  name: 'ShellBreadcrumb',
  props: {
    label: { type: String, default: 'Breadcrumb' },
  },
  setup(props, { slots }) {
    return () =>
      h(
        'nav',
        { 'class': 'pa-shell-breadcrumb', 'aria-label': props.label },
        slots.default?.()
      );
  },
});

export const ShellTabs = defineComponent({
  name: 'ShellTabs',
  props: {
    label: { type: String, default: 'Open pages' },
  },
  setup(props, { slots }) {
    return () =>
      h(
        'nav',
        { 'class': 'pa-shell-tabs', 'aria-label': props.label },
        slots.default?.()
      );
  },
});

export const PageHeader = defineComponent({
  name: 'PageHeader',
  setup(_, { slots }) {
    return () =>
      h('header', { class: 'pa-page-header' }, [
        h('div', { class: 'pa-page-header__title' }, slots.default?.()),
        slots.actions === undefined
          ? null
          : h('div', { class: 'pa-page-header__actions' }, slots.actions()),
      ]);
  },
});

export const PageToolbar = defineComponent({
  name: 'PageToolbar',
  props: {
    label: { type: String, default: 'Page actions' },
  },
  setup(props, { slots }) {
    return () =>
      h(
        'div',
        {
          'class': 'pa-page-toolbar',
          'role': 'toolbar',
          'aria-label': props.label,
        },
        slots.default?.()
      );
  },
});

export const PageContent = defineComponent({
  name: 'PageContent',
  setup(_, { slots }) {
    return () => h('section', { class: 'pa-page-content' }, slots.default?.());
  },
});
