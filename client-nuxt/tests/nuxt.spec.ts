import { describe, expect, it, vi } from 'vitest'

import { createNuxtClientTransport } from '../src/index'
import type { ClientHeaders } from '../../client-core/src/index'

const headers = (values: Record<string, string> = {}): ClientHeaders => {
  const normalized = new Map(
    Object.entries(values).map(([key, value]) => [key.toLowerCase(), value]),
  )
  return {
    delete: name => { normalized.delete(name.toLowerCase()) },
    get: name => normalized.get(name.toLowerCase()) ?? null,
    has: name => normalized.has(name.toLowerCase()),
    set: (name, value) => { normalized.set(name.toLowerCase(), value) },
    forEach: callback => normalized.forEach((value, key) => callback(value, key)),
  }
}

describe('Nuxt client transport', () => {
  it('maps GET and DELETE data to query and other methods to body', async () => {
    const calls: Array<{ url: string; options?: unknown }> = []
    const fetcher = vi.fn(async (url: string, options?: unknown) => {
      calls.push({ url, options })
      return { ok: true }
    })
    const transport = createNuxtClientTransport({ baseUrl: 'https://admin.example/', $fetch: fetcher })
    const requestHeaders = headers({ Authorization: 'Bearer token' })

    await transport({ path: '/items', method: 'GET', data: { page: 2 }, headers: requestHeaders })
    await transport({ path: '/items/1', method: 'DELETE', data: { revision: 3 }, headers: requestHeaders })
    await transport({ path: '/items', method: 'POST', data: { name: 'item' }, headers: requestHeaders })

    expect(calls).toHaveLength(3)
    expect(calls[0]).toMatchObject({ url: 'https://admin.example/items' })
    expect(calls[0]?.options).toMatchObject({ method: 'GET', query: { page: 2 }, headers: { authorization: 'Bearer token' } })
    expect(calls[1]?.options).toMatchObject({ method: 'DELETE', query: { revision: 3 }, headers: { authorization: 'Bearer token' } })
    expect(calls[2]?.options).toMatchObject({ method: 'POST', body: { name: 'item' }, headers: { authorization: 'Bearer token' } })
    expect(calls[2]?.options).not.toHaveProperty('query')
  })

  it('rejects invalid path before calling the fetch function', async () => {
    const fetcher = vi.fn(async () => ({}))
    const transport = createNuxtClientTransport({ baseUrl: 'https://admin.example/', $fetch: fetcher })

    await expect(transport({ path: '//other.example/items', method: 'GET', headers: headers() })).rejects.toMatchObject({
      kind: 'path',
      code: 'CLIENT_PATH_INVALID',
    })
    expect(fetcher).not.toHaveBeenCalled()
  })
})
