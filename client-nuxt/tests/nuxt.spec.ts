import { describe, expect, it, vi } from 'vitest'

import { createNuxtClientTransport } from '../src/index'

describe('Nuxt client transport', () => {
  it('maps GET and DELETE data to query and other methods to body', async () => {
    const calls: Array<{ url: string; options?: unknown }> = []
    const fetcher = vi.fn(async (url: string, options?: unknown) => {
      calls.push({ url, options })
      return { ok: true }
    })
    const transport = createNuxtClientTransport({ baseUrl: 'https://admin.example/', $fetch: fetcher })
    const headers = new Headers({ Authorization: 'Bearer token' })

    await transport({ path: '/items', method: 'GET', data: { page: 2 }, headers })
    await transport({ path: '/items/1', method: 'DELETE', data: { revision: 3 }, headers })
    await transport({ path: '/items', method: 'POST', data: { name: 'item' }, headers })

    expect(calls).toHaveLength(3)
    expect(calls[0]).toMatchObject({ url: 'https://admin.example/items' })
    expect(calls[0]?.options).toMatchObject({ method: 'GET', query: { page: 2 }, headers })
    expect(calls[1]?.options).toMatchObject({ method: 'DELETE', query: { revision: 3 }, headers })
    expect(calls[2]?.options).toMatchObject({ method: 'POST', body: { name: 'item' }, headers })
    expect(calls[2]?.options).not.toHaveProperty('query')
  })

  it('rejects invalid path before calling the fetch function', async () => {
    const fetcher = vi.fn(async () => ({}))
    const transport = createNuxtClientTransport({ baseUrl: 'https://admin.example/', $fetch: fetcher })

    await expect(transport({ path: '//other.example/items', method: 'GET', headers: new Headers() })).rejects.toThrow('CLIENT_PATH_INVALID')
    expect(fetcher).not.toHaveBeenCalled()
  })
})
