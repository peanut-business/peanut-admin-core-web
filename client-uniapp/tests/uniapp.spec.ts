import { describe, expect, it, vi } from 'vitest'

import { createUniAppClientTransport } from '../src/index'
import type { UniAppClientRequestOptions } from '../src/index'

describe('UniApp client transport', () => {
  it('maps the request shape and resolves success.data', async () => {
    let requestOptions: UniAppClientRequestOptions | undefined
    const request = vi.fn((options: UniAppClientRequestOptions) => {
      requestOptions = options
      options.success?.({ data: { ok: true } })
    })
    const transport = createUniAppClientTransport({ baseUrl: 'https://admin.example/', request })

    await expect(transport({
      path: '/items',
      method: 'POST',
      data: { name: 'item' },
      headers: new Headers({ Authorization: 'Bearer token', 'X-Request': 'one' }),
    })).resolves.toEqual({ ok: true })

    expect(request).toHaveBeenCalledOnce()
    expect(requestOptions).toMatchObject({
      url: 'https://admin.example/items',
      method: 'POST',
      data: { name: 'item' },
      header: { authorization: 'Bearer token', 'x-request': 'one' },
    })
  })

  it('rejects the original callback failure and validates the path first', async () => {
    const failure = { errMsg: 'request:fail timeout' }
    const request = vi.fn((options: UniAppClientRequestOptions) => options.fail?.(failure))
    const transport = createUniAppClientTransport({ baseUrl: 'https://admin.example/', request })

    await expect(transport({ path: '/items', method: 'GET', headers: new Headers() })).rejects.toBe(failure)
    expect(request).toHaveBeenCalledOnce()

    const invalidRequest = vi.fn((options: UniAppClientRequestOptions) => options.success?.({ data: true }))
    const invalidTransport = createUniAppClientTransport({ baseUrl: 'https://admin.example/', request: invalidRequest })
    await expect(invalidTransport({ path: '/items/../admin', method: 'GET', headers: new Headers() })).rejects.toMatchObject({
      kind: 'path',
      code: 'CLIENT_PATH_INVALID',
    })
    expect(invalidRequest).not.toHaveBeenCalled()
  })
})
