import { describe, expect, it, vi } from 'vitest'

import {
  createAdminNavigationRegistry,
  createTenantLifecycle,
  defineAdminHostConfig,
  mapAdminRuntimeError,
  runAdminRouteGuard,
} from '../src/index'

const hostConfig = () => ({
  tenant: {
    baseUrl: 'https://tenant-api.example.test',
    allowedOrigin: 'https://tenant-api.example.test',
    clientKey: 'tenant-web',
  },
  platform: {
    baseUrl: 'https://platform-api.example.test',
    allowedOrigin: 'https://platform-api.example.test',
    clientKey: 'platform-web',
  },
})

describe('host-owned admin runtime configuration', () => {
  it('normalizes independent tenant and platform API authorities', () => {
    expect(defineAdminHostConfig(hostConfig())).toEqual(hostConfig())
  })

  it('rejects an invalid or mismatched origin before runtime callbacks exist', () => {
    expect(() => defineAdminHostConfig({
      ...hostConfig(),
      tenant: {
        ...hostConfig().tenant,
        allowedOrigin: 'https://user:secret@tenant-api.example.test',
      },
    })).toThrow('ADMIN_HOST_ORIGIN_INVALID')

    expect(() => defineAdminHostConfig({
      ...hostConfig(),
      platform: {
        ...hostConfig().platform,
        allowedOrigin: 'https://other.example.test',
      },
    })).toThrow('ADMIN_HOST_ORIGIN_MISMATCH')
  })
})

describe('build-time navigation registry', () => {
  const routes = [{
    name: 'tenant.home',
    path: '/app',
    audience: 'tenant' as const,
  }, {
    name: 'platform.home',
    path: '/platform',
    audience: 'platform' as const,
  }]

  it('resolves only trusted route names and records unknown server entries', () => {
    const registry = createAdminNavigationRegistry({ routes, modules: [] })

    expect(registry.resolveMenu({
      route_name: 'tenant.home',
      route_path: '/platform',
      component: 'server/InjectedComponent.vue',
    })?.path).toBe('/app')
    expect(registry.resolveMenu({
      route_name: 'server.injected',
      route_path: '/app',
      component: 'tenant.home',
    })).toBeNull()
    expect(registry.diagnostics()).toEqual(['server.injected'])
  })

  it('rejects duplicate names and paths across host registrations', () => {
    expect(() => createAdminNavigationRegistry({
      routes: [...routes, { ...routes[0]!, path: '/app/duplicate' }],
      modules: [],
    })).toThrow('ADMIN_ROUTE_REGISTRY_CONFLICT')
    expect(() => createAdminNavigationRegistry({
      routes: [...routes, { ...routes[0]!, name: 'tenant.duplicate' }],
      modules: [],
    })).toThrow('ADMIN_ROUTE_REGISTRY_CONFLICT')
  })

})

describe('admin route guard', () => {
  it('loads trusted state before checking Module and permission access', async () => {
    const calls: string[] = []
    const result = await runAdminRouteGuard({
      audience: 'tenant',
      moduleKey: 'example.work-item',
      permissionKeys: ['example.work-item.read'],
    }, {
      enterAudience: async () => { calls.push('audience') },
      ensureContext: async () => { calls.push('context') },
      loadNavigation: async () => { calls.push('navigation') },
      hasModule: () => { calls.push('module'); return true },
      hasPermissions: () => { calls.push('permission'); return true },
    })

    expect(result).toEqual({ status: 'allowed' })
    expect(calls).toEqual(['audience', 'context', 'navigation', 'module', 'permission'])
  })

  it('fails before permission evaluation when the Module is unavailable', async () => {
    const hasPermissions = vi.fn(() => true)
    const result = await runAdminRouteGuard({
      audience: 'tenant',
      moduleKey: 'example.work-item',
      permissionKeys: ['example.work-item.read'],
    }, {
      enterAudience: vi.fn(async () => undefined),
      ensureContext: vi.fn(async () => undefined),
      loadNavigation: vi.fn(async () => undefined),
      hasModule: () => false,
      hasPermissions,
    })

    expect(result).toEqual({ status: 'module-unavailable', code: 'MODULE_TENANT_DISABLED' })
    expect(hasPermissions).not.toHaveBeenCalled()
  })
})

describe('runtime error mapping', () => {
  it.each([
    [401, 'AUTH_SESSION_EXPIRED', 'login'],
    [403, 'AUTHZ_FUNCTIONAL_DENIED', 'forbidden'],
    [404, 'RESOURCE_NOT_FOUND', 'not-found'],
    [409, 'WRITE_CONFLICT', 'conflict'],
    [412, 'REVISION_MISMATCH', 'conflict'],
    [429, 'RATE_LIMITED', 'rate-limited'],
    [503, 'SERVICE_UNAVAILABLE', 'unavailable'],
  ] as const)('maps HTTP %s to %s', (status, code, expected) => {
    expect(mapAdminRuntimeError({
      problem: {
        type: '/docs/problems/test',
        title: 'Request failed',
        status,
        detail: 'Request failed.',
        code,
        request_id: 'req_test',
      },
      retryAfter: status === 429 ? '7' : null,
    }, 'tenant')).toMatchObject({ kind: expected, code, requestId: 'req_test' })
  })

  it('maps protected-origin failures without exposing configured authorities', () => {
    expect(mapAdminRuntimeError(new Error('API_ORIGIN_MISMATCH'), 'platform')).toEqual({
      kind: 'configuration',
      audience: 'platform',
      code: 'API_ORIGIN_MISMATCH',
      requestId: null,
      retryAfter: null,
    })
  })
})

describe('tenant lifecycle generation', () => {
  it('aborts old work and rejects late writes after invalidation', () => {
    const lifecycle = createTenantLifecycle()
    const oldWork = lifecycle.capture()

    lifecycle.invalidate()

    expect(oldWork.signal.aborted).toBe(true)
    expect(oldWork.isCurrent()).toBe(false)
    expect(lifecycle.capture().isCurrent()).toBe(true)
  })
})
