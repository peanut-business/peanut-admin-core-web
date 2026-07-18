import createClient from 'openapi-fetch'
import type { Client } from 'openapi-fetch'

import type { paths } from '../generated/api'
import { createBrowserRefreshCoordinator } from './refresh'
import type { RefreshCoordinator } from './refresh'

export type ApiAudience = 'tenant' | 'platform'

export interface AudienceApiClientOptions {
  baseUrl?: string
  fetch?: (request: Request) => Promise<Response>
  getAccessToken: () => string | null
  setAccessToken: (token: string) => void
  refresh: () => Promise<string | null>
  refreshScope: string
  refreshCoordinator?: RefreshCoordinator
  createRequestId?: () => string
}

export type AudienceApiClient = Client<paths>

const requestId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `req_${globalThis.crypto.randomUUID().replaceAll('-', '')}`
  }

  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
}

const isAudiencePath = (audience: ApiAudience, pathname: string): boolean => audience === 'tenant'
  ? pathname.startsWith('/api/v1/')
  : pathname.startsWith('/api/platform/v1/')

const isCredentialExchange = (pathname: string): boolean => (
  /\/auth\/(?:login|refresh|tenants\/select)$/.test(pathname)
)

const canReplay = (request: Request): boolean => (
  ['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase())
  || request.headers.has('Idempotency-Key')
)

const withSecurityHeaders = (
  request: Request,
  token: string | null,
  createRequestId: () => string,
): Request => {
  const headers = new Headers(request.headers)
  if (token !== null && token !== '') {
    headers.set('Authorization', `Bearer ${token}`)
  } else {
    headers.delete('Authorization')
  }
  if (!headers.has('X-Request-Id')) {
    headers.set('X-Request-Id', createRequestId())
  }

  return new Request(request, { headers, credentials: 'include' })
}

export interface ProtectedFetchOptions extends AudienceApiClientOptions {
  isAllowedPath: (pathname: string) => boolean
  isCredentialExchange?: (pathname: string) => boolean
}

const defaultRefreshCoordinator = createBrowserRefreshCoordinator()

export const createProtectedFetch = (options: ProtectedFetchOptions): ((request: Request) => Promise<Response>) => {
  const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis)
  const createRequestId = options.createRequestId ?? requestId
  const refreshCoordinator = options.refreshCoordinator ?? defaultRefreshCoordinator
  const credentialExchange = options.isCredentialExchange ?? isCredentialExchange

  const refreshOnce = async (failedToken: string | null): Promise<string | null> => {
    const token = await refreshCoordinator.coordinate({
      scope: options.refreshScope,
      failedToken,
      getAccessToken: options.getAccessToken,
      refresh: options.refresh,
    })
    if (token !== null && token !== '') options.setAccessToken(token)
    return token
  }

  return async (input: Request): Promise<Response> => {
    const url = new URL(input.url)
    if (!options.isAllowedPath(url.pathname)) {
      throw new Error(`API_AUDIENCE_MISMATCH: protected client cannot request ${url.pathname}`)
    }

    const failedToken = options.getAccessToken()
    const firstRequest = withSecurityHeaders(input, failedToken, createRequestId)
    const retrySource = firstRequest.clone()
    const response = await fetcher(firstRequest)
    if (response.status !== 401 || credentialExchange(url.pathname)) {
      return response
    }

    const refreshedToken = await refreshOnce(failedToken)
    if (refreshedToken === null || refreshedToken === '' || !canReplay(retrySource)) {
      return response
    }

    return fetcher(withSecurityHeaders(retrySource, refreshedToken, createRequestId))
  }
}

const createAudienceClient = (
  audience: ApiAudience,
  options: AudienceApiClientOptions,
): AudienceApiClient => {
  const securedFetch = createProtectedFetch({
    ...options,
    isAllowedPath: pathname => isAudiencePath(audience, pathname),
  })

  return createClient<paths>({
    baseUrl: options.baseUrl ?? '',
    credentials: 'include',
    fetch: securedFetch,
    querySerializer: { array: { style: 'form', explode: false } },
  })
}

export const createTenantApiClient = (options: AudienceApiClientOptions): AudienceApiClient => (
  createAudienceClient('tenant', options)
)

export const createPlatformApiClient = (options: AudienceApiClientOptions): AudienceApiClient => (
  createAudienceClient('platform', options)
)
