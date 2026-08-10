import { describe, expect, it, vi } from 'vitest'

import {
  ClientRequestError,
  createClient,
  resolveClientUrl,
} from '../src/index'
import type {
  ClientDecodeResult,
  ClientSession,
  ClientTransport,
  ClientTransportRequest,
} from '../src/index'

const session = (token: string | null = 'token'): ClientSession => ({
  accessToken: vi.fn(() => token),
  clear: vi.fn(),
})

const successful = <T>(data: T): ClientDecodeResult<T> => ({ kind: 'success', data })

const transportRequest = (transport: ClientTransport): ClientTransportRequest => {
  const calls = vi.mocked(transport).mock.calls
  const request = calls.at(-1)?.[0]
  if (request === undefined) throw new Error('transport was not called')
  return request
}

describe('client request state machine', () => {
  it('rejects unsafe paths before reading the session token', async () => {
    const clientSession = session()
    const transport = vi.fn(async () => ({ ok: true }))
    const client = createClient({
      transport,
      session: clientSession,
      decoder: () => successful({ ok: true }),
    })

    for (const path of ['', 'https://other.test/items', ' https://other.test/items', '//other.test/items', '/items\\next', '/items\nnext', '/items/./next', '/items/../next']) {
      await expect(client.request({ path })).rejects.toMatchObject({
        kind: 'path',
        code: 'CLIENT_PATH_INVALID',
      })
    }
    expect(clientSession.accessToken).not.toHaveBeenCalled()
    expect(transport).not.toHaveBeenCalled()
  })

  it('strips caller authorization and adds one bearer token only for auth requests', async () => {
    const transport = vi.fn(async () => ({ ok: true }))
    const clientSession = session('access-token')
    const client = createClient({
      transport,
      session: clientSession,
      decoder: () => successful({ ok: true }),
    })

    await client.request({
      path: '/items',
      headers: { Authorization: 'caller', authorization: 'also-caller', 'X-Test': 'yes' },
    })
    const secured = transportRequest(transport)
    expect(secured.headers.get('authorization')).toBe('Bearer access-token')
    expect(secured.headers.get('X-Test')).toBe('yes')

    await client.request({ path: '/public', auth: false, headers: { Authorization: 'caller' } })
    expect(transportRequest(transport).headers.has('Authorization')).toBe(false)
  })

  it('returns decoded success data and maps business failures to stable errors', async () => {
    const businessHook = vi.fn()
    const client = createClient({
      transport: vi.fn(async () => ({ envelope: true })),
      session: session(),
      decoder: vi.fn((response: unknown) => response instanceof Object && 'envelope' in response
        ? successful({ id: 'item-1' })
        : { kind: 'business' as const, code: 'ITEM_DENIED', message: 'Not allowed.' }),
      hooks: { businessError: businessHook },
    })

    await expect(client.request<{ id: string }>({ path: '/items' })).resolves.toEqual({ id: 'item-1' })

    const denied = createClient({
      transport: vi.fn(async () => null),
      session: session(),
      decoder: () => ({ kind: 'business', code: 'ITEM_DENIED', message: 'Not allowed.' }),
      hooks: { businessError: businessHook },
    })
    await expect(denied.request({ path: '/items' })).rejects.toMatchObject({
      kind: 'business',
      code: 'ITEM_DENIED',
      message: 'Not allowed.',
    })
    expect(businessHook).toHaveBeenCalledOnce()
  })

  it('clears once before one unauthorized hook for concurrent failures', async () => {
    let releaseClear: (() => void) | undefined
    const clear = vi.fn(() => new Promise<void>(resolve => { releaseClear = resolve }))
    const unauthorizedHook = vi.fn()
    const client = createClient({
      transport: vi.fn(async () => ({ unauthorized: true })),
      session: { accessToken: vi.fn(() => 'token'), clear },
      decoder: () => ({ kind: 'unauthorized', code: 'AUTH_EXPIRED', message: 'Sign in again.' }),
      hooks: { unauthorized: unauthorizedHook },
    })

    const first = client.request({ path: '/first' })
    const second = client.request({ path: '/second' })
    await vi.waitFor(() => expect(clear).toHaveBeenCalledOnce())
    expect(unauthorizedHook).not.toHaveBeenCalled()
    releaseClear?.()
    await expect(first).rejects.toMatchObject({ kind: 'unauthorized', code: 'AUTH_EXPIRED' })
    await expect(second).rejects.toMatchObject({ kind: 'unauthorized', code: 'AUTH_EXPIRED' })
    expect(unauthorizedHook).toHaveBeenCalledOnce()
    expect(clear.mock.invocationCallOrder[0]).toBeLessThan(unauthorizedHook.mock.invocationCallOrder[0] ?? Infinity)
  })

  it('fails closed without invoking the unauthorized hook when session clearing fails', async () => {
    const unauthorizedHook = vi.fn()
    const client = createClient({
      transport: vi.fn(async () => null),
      session: {
        accessToken: vi.fn(() => 'token'),
        clear: vi.fn(async () => { throw new Error('secret session failure') }),
      },
      decoder: () => ({ kind: 'unauthorized' }),
      hooks: { unauthorized: unauthorizedHook },
    })

    await expect(client.request({ path: '/items' })).rejects.toMatchObject({
      kind: 'session',
      code: 'CLIENT_SESSION_CLEAR_ERROR',
      message: 'The client session could not be cleared.',
    })
    expect(unauthorizedHook).not.toHaveBeenCalled()
  })

  it('does not expose transport exceptions or malformed decoder values', async () => {
    const transportFailure = createClient({
      transport: vi.fn(async () => { throw new Error('token=secret raw response') }),
      session: session(),
      decoder: () => successful(null),
    })
    const transportError = await transportFailure.request({ path: '/items' }).catch(error => error)
    expect(transportError).toBeInstanceOf(ClientRequestError)
    expect(transportError).toMatchObject({ kind: 'transport', code: 'CLIENT_TRANSPORT_ERROR' })
    if (!(transportError instanceof ClientRequestError)) throw new Error('expected ClientRequestError')
    expect(transportError.message).not.toContain('secret')

    const malformed = createClient({
      transport: vi.fn(async () => null),
      session: session(),
      decoder: () => ({ kind: 'unknown' } as never),
    })
    await expect(malformed.request({ path: '/items' })).rejects.toMatchObject({
      kind: 'decoder',
      code: 'CLIENT_DECODER_INVALID',
    })

    const undeclaredAlias = createClient({
      transport: vi.fn(async () => null),
      session: session(),
      decoder: () => ({ status: 'success', data: 'unexpected' } as never),
    })
    await expect(undeclaredAlias.request({ path: '/items' })).rejects.toMatchObject({
      kind: 'decoder',
      code: 'CLIENT_DECODER_INVALID',
    })
  })
})

describe('client URL composition', () => {
  it('validates paths before composing an HTTP URL', () => {
    expect(resolveClientUrl('https://admin.example/base/', '/api/v1/items')).toBe('https://admin.example/api/v1/items')
    try {
      resolveClientUrl('https://admin.example/', 'https://other.example/items')
      throw new Error('expected invalid path')
    } catch (error) {
      expect(error).toMatchObject({ kind: 'path', code: 'CLIENT_PATH_INVALID' })
    }
    try {
      resolveClientUrl('https://user:secret@admin.example/', '/api')
      throw new Error('expected invalid base URL')
    } catch (error) {
      expect(error).toMatchObject({ kind: 'path', code: 'CLIENT_BASE_URL_INVALID' })
    }
  })

  it('does not require browser Headers or URL globals', async () => {
    vi.stubGlobal('Headers', undefined)
    vi.stubGlobal('URL', undefined)
    try {
      const transport = vi.fn(async () => ({ ok: true }))
      const client = createClient({
        transport,
        session: session('portable-token'),
        decoder: () => successful({ ok: true }),
      })

      await client.request({ path: '/items', headers: { 'X-Client': 'uniapp' } })
      const request = transportRequest(transport)
      expect(request.headers.get('authorization')).toBe('Bearer portable-token')
      expect(request.headers.get('x-client')).toBe('uniapp')
      expect(resolveClientUrl('https://admin.example/base/', 'items')).toBe(
        'https://admin.example/base/items',
      )
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
