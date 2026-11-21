import { defineAdminOverrideSlot } from '@peanut-admin/vue';
import type { AdminOverrideRegistry, ApiAudience } from '@peanut-admin/vue';
import type { Component } from 'vue';

import { AdminShell, PlatformShell } from './layout.js';

export const WORKSPACE_SHELL_OVERRIDE_KEY =
  'peanut.shell.service.workspace-component' as const;

export const LOGIN_EXTRA_OVERRIDE_KEY =
  'peanut.shell.component.login-extra' as const;
export const NAVBAR_ACTIONS_OVERRIDE_KEY =
  'peanut.shell.component.navbar-actions' as const;
export const WORKBENCH_EXTRA_OVERRIDE_KEY =
  'peanut.shell.component.workbench-extra' as const;
export const FOOTER_OVERRIDE_KEY =
  'peanut.shell.component.footer' as const;

export type WorkspaceShellResolver = (audience: ApiAudience) => Component;

const defaultWorkspaceShell: WorkspaceShellResolver = (audience) =>
  audience === 'tenant' ? AdminShell : PlatformShell;

const isWorkspaceShellResolver = (
  value: unknown
): value is WorkspaceShellResolver => typeof value === 'function';

const isVueComponent = (value: unknown): value is Component => {
  if (typeof value === 'function') return true;
  if (typeof value !== 'object' || value === null) return false;
  const component = value as Record<string, unknown>;
  return (
    typeof component.setup === 'function' ||
    typeof component.render === 'function' ||
    typeof component.template === 'string' ||
    typeof component.__asyncLoader === 'function'
  );
};

const optionalComponentSlot = <Key extends string>(key: Key) =>
  defineAdminOverrideSlot({
    key,
    kind: 'component',
    contractVersion: '1.0.0',
    defaultValue: null as Component | null,
    validate: (value): value is Component | null =>
      value === null || isVueComponent(value),
  });

export const ADMIN_SHELL_OVERRIDE_SLOTS = [
  defineAdminOverrideSlot({
    key: WORKSPACE_SHELL_OVERRIDE_KEY,
    kind: 'service',
    contractVersion: '1.0.0',
    defaultValue: defaultWorkspaceShell,
    validate: isWorkspaceShellResolver,
  }),
  optionalComponentSlot(LOGIN_EXTRA_OVERRIDE_KEY),
  optionalComponentSlot(NAVBAR_ACTIONS_OVERRIDE_KEY),
  optionalComponentSlot(WORKBENCH_EXTRA_OVERRIDE_KEY),
  optionalComponentSlot(FOOTER_OVERRIDE_KEY),
] as const;

export type AdminShellOverrideRegistry = AdminOverrideRegistry<
  typeof ADMIN_SHELL_OVERRIDE_SLOTS
>;

export const resolveWorkspaceShell = (
  registry: {
    get(key: typeof WORKSPACE_SHELL_OVERRIDE_KEY): WorkspaceShellResolver;
  },
  audience: ApiAudience
): Component => {
  const component = registry.get(WORKSPACE_SHELL_OVERRIDE_KEY)(audience);
  if (!isVueComponent(component))
    throw new Error('ADMIN_SHELL_OVERRIDE_RESULT_INVALID');
  return component;
};
