import { describe, expect, it } from 'vitest'

import {
  createGovernanceCatalog,
  explainMenuVisibility,
  prepareDataPolicyChange,
  prepareRolePermissionChange,
  projectAuditDetail,
} from '../../src/governance/index'

describe('governance catalog', () => {
  const catalog = createGovernanceCatalog({
    permissions: [
      { key: 'core.role.read', moduleKey: 'core', audience: 'tenant', active: true },
      { key: 'example.report.read', moduleKey: 'example.report', audience: 'tenant', active: true },
      { key: 'platform.role.read', moduleKey: 'platform', audience: 'platform', active: true },
    ],
    routes: [
      { name: 'tenant.roles.list', path: '/app/roles', audience: 'tenant', permissionKeys: ['core.role.read'] },
      { name: 'example.report.list', path: '/app/reports', audience: 'tenant', moduleKey: 'example.report', permissionKeys: ['example.report.read'] },
    ],
    icons: {
      Shield: { label: 'Roles', glyph: 'S' },
      Files: { label: 'Files', glyph: 'F' },
    },
  })

  it('explains module and permission visibility without trusting server paths', () => {
    expect(explainMenuVisibility({
      key: 'example.report',
      type: 'page',
      routeName: 'example.report.list',
      routePath: '/injected',
      requiredPermission: 'example.report.read',
      moduleKey: 'example.report',
      icon: 'Files',
    }, {
      audience: 'tenant',
      deploymentModules: new Set(['example.report']),
      tenantModules: new Set(),
      permissions: new Set(['example.report.read']),
    }, catalog)).toMatchObject({ visible: false, reason: 'tenant_module_disabled', trustedPath: '/app/reports' })

    expect(() => explainMenuVisibility({
      key: 'injected', type: 'page', routeName: 'server.injected', routePath: '/app/injected', requiredPermission: 'core.role.read', moduleKey: 'core', icon: 'Shield',
    }, {
      audience: 'tenant', deploymentModules: new Set(), tenantModules: new Set(), permissions: new Set(['core.role.read']),
    }, catalog)).toThrow('GOVERNANCE_ROUTE_UNDECLARED')
  })

  it('requires strong revisions and declared same-audience permissions and conditions', () => {
    expect(prepareRolePermissionChange({
      audience: 'tenant', roleId: '9', currentRevision: 4, ifMatch: '"rev-4"', permissionKeys: ['core.role.read', 'core.role.read'], availableModules: new Set(), catalog,
    }).permissionKeys).toEqual(['core.role.read'])
    expect(() => prepareRolePermissionChange({
      audience: 'tenant', roleId: '9', currentRevision: 4, ifMatch: '"rev-4"', permissionKeys: ['platform.role.read'], availableModules: new Set(), catalog,
    })).toThrow('GOVERNANCE_PERMISSION_AUDIENCE_MISMATCH')

    expect(prepareDataPolicyChange({
      audience: 'tenant', roleId: '9', currentRevision: 7, ifMatch: '"rev-7"', resourceKey: 'example.report', operation: 'list', conditionKeys: ['core.specified_objects'], availableModules: new Set(['example.report']),
      operations: [{ resourceKey: 'example.report', operation: 'list', moduleKey: 'example.report', audience: 'tenant', conditionKeys: ['core.tenant_wide', 'core.specified_objects'] }],
    }).conditionKeys).toEqual(['core.specified_objects'])
  })

  it('projects audit details through a scalar metadata allowlist', () => {
    expect(projectAuditDetail({
      id: '12', audience: 'tenant', eventType: 'tenant.role.updated', action: 'core.role.update', outcome: 'success', requestId: 'req_123', occurredAt: '2026-07-24T00:00:00.000Z',
      metadata: { revision: 7, permission_count: 3, token: 'secret', sql: 'SELECT secret', raw_target_set: ['101'] },
    }, ['revision', 'permission_count'])).toMatchObject({ metadata: { permission_count: 3, revision: 7 } })
  })
})
