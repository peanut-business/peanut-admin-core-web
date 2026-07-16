import { describe, expect, it, vi } from 'vitest'

import {
  assertTenantStateDisposed,
  createRouteGuardHarness,
  mockAccessState,
  mockProblemDetails,
  mockTenantContext,
} from '../src/index'

describe('web testing support', () => {
  it('builds typed tenant and problem fixtures without persistence fields', () => {
    const context = mockTenantContext({ tenantId: '99' })
    const problem = mockProblemDetails({ code: 'MODULE_TENANT_DISABLED', status: 503 })
    const access = mockAccessState({ permissionKeys: ['core.member.read'], moduleKeys: ['core'] })

    expect(context.tenantId).toBe('99')
    expect('currentTarget' in context).toBe(false)
    expect(problem.request_id).toMatch(/^req_/)
    expect(access.hasPermission('core.member.read')).toBe(true)
  })

  it('routes each namespace through only its matching audience guard', async () => {
    const tenant = vi.fn(async () => true)
    const platform = vi.fn(async () => true)
    const harness = createRouteGuardHarness({ tenant, platform })

    expect(await harness.navigate('/app/members')).toBe('allowed')
    expect(await harness.navigate('/platform/tenants')).toBe('allowed')
    expect(tenant).toHaveBeenCalledTimes(1)
    expect(platform).toHaveBeenCalledTimes(1)
  })

  it('detects tenant state retained across a switch', async () => {
    await expect(assertTenantStateDisposed(
      () => ({ targets: ['9001'] }),
      async () => undefined,
    )).rejects.toThrow('TENANT_STATE_LEAK')
  })
})
