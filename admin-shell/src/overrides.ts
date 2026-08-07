import {
  defineAdminOverrideSlot,
} from '@peanut-admin/admin/core'
import type {
  AdminOverrideRegistry,
  ApiAudience,
} from '@peanut-admin/admin/core'
import type { Component } from 'vue'

import { AdminShell, PlatformShell } from './layout'

export const WORKSPACE_SHELL_OVERRIDE_KEY = 'peanut.shell.service.workspace-component' as const

export type WorkspaceShellResolver = (audience: ApiAudience) => Component

const defaultWorkspaceShell: WorkspaceShellResolver = audience => (
  audience === 'tenant' ? AdminShell : PlatformShell
)

const isWorkspaceShellResolver = (value: unknown): value is WorkspaceShellResolver => (
  typeof value === 'function'
)

const isVueComponent = (value: unknown): value is Component => {
  if (typeof value === 'function') return true
  if (typeof value !== 'object' || value === null) return false
  const component = value as Record<string, unknown>
  return typeof component.setup === 'function'
    || typeof component.render === 'function'
    || typeof component.template === 'string'
    || typeof component.__asyncLoader === 'function'
}

export const ADMIN_SHELL_OVERRIDE_SLOTS = [
  defineAdminOverrideSlot({
    key: WORKSPACE_SHELL_OVERRIDE_KEY,
    kind: 'service',
    contractVersion: '1.0.0',
    defaultValue: defaultWorkspaceShell,
    validate: isWorkspaceShellResolver,
  }),
] as const

export type AdminShellOverrideRegistry = AdminOverrideRegistry<typeof ADMIN_SHELL_OVERRIDE_SLOTS>

export const resolveWorkspaceShell = (
  registry: AdminShellOverrideRegistry,
  audience: ApiAudience,
): Component => {
  const component = registry.get(WORKSPACE_SHELL_OVERRIDE_KEY)(audience)
  if (!isVueComponent(component)) throw new Error('ADMIN_SHELL_OVERRIDE_RESULT_INVALID')
  return component
}
