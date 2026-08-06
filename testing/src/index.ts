import type {
  PlatformContextData,
  ProblemDetails,
  TenantContextData,
} from '@peanut-admin/admin/core'

export const WEB_TESTING_PACKAGE = '@peanut-admin/admin/testing' as const
export const WEB_TESTING_VERSION = '0.1.0' as const

export const mockTenantContext = (
  overrides: Partial<TenantContextData> = {},
): TenantContextData => ({
  audience: 'tenant',
  accountId: '1',
  tenantId: '10',
  memberId: '20',
  moduleKeys: ['core'],
  permissionKeys: ['core.member.read'],
  authorizationRevision: '1',
  ...overrides,
})

export const mockPlatformContext = (
  overrides: Partial<PlatformContextData> = {},
): PlatformContextData => ({
  audience: 'platform',
  accountId: '1',
  operatorId: '30',
  permissionKeys: ['platform.tenant.read'],
  authorizationRevision: '1',
  ...overrides,
})

export interface MockProblemOptions extends Partial<ProblemDetails> {
  code: string
  status: number
}

export const mockProblemDetails = (options: MockProblemOptions): ProblemDetails => {
  const { code, status, ...overrides } = options

  return {
    type: `/docs/problems/${code.toLowerCase().replaceAll('_', '-')}`,
    title: 'Request rejected',
    status,
    detail: 'The request was rejected by the test fixture.',
    code,
    request_id: 'req_web_testing_fixture',
    ...overrides,
  }
}

export interface MockAccessState {
  permissionKeys: ReadonlySet<string>
  moduleKeys: ReadonlySet<string>
  hasPermission: (permission: string) => boolean
  hasModule: (moduleKey: string) => boolean
}

export const mockAccessState = (options: {
  permissionKeys?: readonly string[]
  moduleKeys?: readonly string[]
} = {}): MockAccessState => {
  const permissionKeys = new Set(options.permissionKeys ?? [])
  const moduleKeys = new Set(options.moduleKeys ?? [])

  return {
    permissionKeys,
    moduleKeys,
    hasPermission: permission => permission !== '*' && permissionKeys.has(permission),
    hasModule: moduleKey => moduleKeys.has(moduleKey),
  }
}

export type GuardResult = boolean | Promise<boolean>
export type AudienceGuard = (path: string) => GuardResult

export interface RouteGuardHarness {
  navigate: (path: string) => Promise<'allowed' | 'denied'>
}

export const createRouteGuardHarness = (guards: {
  tenant: AudienceGuard
  platform: AudienceGuard
}): RouteGuardHarness => ({
  async navigate(path) {
    const pathname = new URL(path, 'https://peanut-admin.test').pathname
    if (pathname === '/app' || pathname.startsWith('/app/')) {
      return await guards.tenant(pathname) ? 'allowed' : 'denied'
    }
    if (pathname === '/platform' || pathname.startsWith('/platform/')) {
      return await guards.platform(pathname) ? 'allowed' : 'denied'
    }

    return 'allowed'
  },
})

const containsTenantState = (value: unknown): boolean => {
  if (value === null || value === undefined || value === false || value === '' || value === 0) {
    return false
  }
  if (Array.isArray(value)) {
    return value.length > 0
  }
  if (value instanceof Map || value instanceof Set) {
    return value.size > 0
  }
  if (typeof value === 'object') {
    return Object.values(value).some(containsTenantState)
  }

  return true
}

export const assertTenantStateDisposed = async (
  inspect: () => unknown,
  switchTenant: () => void | Promise<void>,
): Promise<void> => {
  await switchTenant()
  if (containsTenantState(inspect())) {
    throw new Error('TENANT_STATE_LEAK')
  }
}

export interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: unknown) => void
}

export const createDeferred = <T>(): Deferred<T> => {
  let resolve!: Deferred<T>['resolve']
  let reject!: Deferred<T>['reject']
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, resolve, reject }
}
