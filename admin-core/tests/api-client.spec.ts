import { describe, expect, it, vi } from 'vitest'

import {
  createPlatformApiClient,
  createTenantApiClient,
  isProblemCode,
  parseProblemDetails,
} from '../src/index'

const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' },
})

describe('audience API clients', () => {
  it('coordinates concurrent tenant refresh into one rotation', async () => {
    let token = 'expired'
    const refresh = vi.fn(async () => {
      token = 'fresh'
      return token
    })
    const fetcher = vi.fn(async (request: Request) => {
      return request.headers.get('Authorization') === 'Bearer fresh'
        ? json({ data: { id: '10' } })
        : json({ type: '/docs/problems/session-expired', title: 'Expired', status: 401, detail: 'Expired', code: 'AUTH_SESSION_EXPIRED', request_id: 'req_test_1' }, 401)
    })
    const client = createTenantApiClient({
      baseUrl: 'https://example.test',
      fetch: fetcher,
      getAccessToken: () => token,
      refresh,
    })

    const [first, second] = await Promise.all([
      client.GET('/api/v1/tenant'),
      client.GET('/api/v1/tenant'),
    ])

    expect(first.data).toEqual({ data: { id: '10' } })
    expect(second.data).toEqual({ data: { id: '10' } })
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('rejects a request that crosses the configured audience', async () => {
    const client = createPlatformApiClient({
      baseUrl: 'https://example.test',
      fetch: vi.fn(),
      getAccessToken: () => 'platform-token',
      refresh: async () => null,
    })

    await expect(client.GET('/api/v1/tenant')).rejects.toThrow('API_AUDIENCE_MISMATCH')
  })

  it('serializes multi-target query arrays without duplicate PHP keys', async () => {
    let requestedUrl = ''
    const client = createTenantApiClient({
      baseUrl: 'https://example.test',
      fetch: vi.fn(async (request: Request) => {
        requestedUrl = request.url
        return json({ data: [], meta: { page: 1, page_size: 20, total: 0, total_pages: 0 } })
      }),
      getAccessToken: () => 'tenant-token',
      refresh: async () => null,
    })

    await client.GET('/api/v1/example/work-items', {
      params: { query: {
        target_resource_key: 'example.project',
        target_role: 'primary',
        target_id: ['1', '2'],
      } },
    })

    expect(requestedUrl).toContain('target_id=1,2')
    expect(requestedUrl).not.toContain('target_id=1&target_id=2')
  })

  it('parses only RFC 9457-shaped problems', () => {
    const problem = parseProblemDetails({
      type: '/docs/problems/precondition-required',
      title: 'Precondition required',
      status: 428,
      detail: 'If-Match is required.',
      code: 'PRECONDITION_REQUIRED',
      request_id: 'req_test_2',
    })

    expect(isProblemCode(problem, 'PRECONDITION_REQUIRED')).toBe(true)
    expect(parseProblemDetails({ code: 'INCOMPLETE' })).toBeNull()
  })
})
