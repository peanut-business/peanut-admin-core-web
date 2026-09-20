import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import {
  hasAllPermissions,
  hasPermission,
  useAccess,
  useTenantContext,
} from '../src/index'

describe('permission hints', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('uses a set and never treats frontend hints as wildcard authority', () => {
    const context = useTenantContext()
    context.replace({
      audience: 'tenant',
      accountId: '1',
      tenantId: '10',
      memberId: '20',
      moduleKeys: ['core'],
      permissionKeys: ['core.member.read'],
      authorizationRevision: '3',
    })

    expect(hasPermission(context.permissionSet, 'core.member.read')).toBe(true)
    expect(hasPermission(context.permissionSet, '*')).toBe(false)
    expect(hasAllPermissions(context.permissionSet, ['core.member.read'])).toBe(true)
    expect(useAccess().can('core.member.update')).toBe(false)
  })
})
