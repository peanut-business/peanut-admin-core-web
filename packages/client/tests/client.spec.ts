import { describe, expect, it, vi } from 'vitest';

import {
  ClientRequestError,
  createClient,
  createSessionRecovery,
  createSessionFetch,
  resolveClientUrl,
} from '../src/index';
import type {
  ClientDecodeResult,
  ClientSession,
  ClientTransport,
  ClientTransportRequest,
} from '../src/index';

describe('shared session recovery', () => {
  function host() {
    let current = { generation: 1, token: 'old' as string | null };
    const rejected = new Error('credential rejected');
    const invalidate = vi.fn(async () => { current = { generation: current.generation + 1, token: null }; });
    const refresh = vi.fn(async () => { current = { ...current, token: 'new' }; return 'new'; });
    const recovery = createSessionRecovery({
      current: () => ({ ...current }), isRefreshable: (token) => token !== null,
      refresh, isRefreshRejected: (error) => error === rejected, invalidate,
    });
    return { recovery, refresh, invalidate, rejected, switch: () => { current = { generation: 2, token: 'other-user' }; } };
  }

  it('merges concurrent refresh and invalidation across transports', async () => {
    const h = host();
    const snapshot = h.recovery.current();
    expect(await Promise.all([h.recovery.refresh(snapshot), h.recovery.refresh(snapshot)])).toEqual(['new', 'new']);
    expect(h.refresh).toHaveBeenCalledTimes(1);
    const refreshed = h.recovery.current();
    await Promise.all([h.recovery.invalidate(refreshed), h.recovery.invalidate(refreshed)]);
    expect(h.invalidate).toHaveBeenCalledTimes(1);
  });

  it('clears definitive refresh rejection, but preserves network failures and new logins', async () => {
    const h = host();
    h.refresh.mockRejectedValueOnce(new Error('network'));
    await expect(h.recovery.refresh(h.recovery.current())).rejects.toThrow('network');
    expect(h.invalidate).not.toHaveBeenCalled();
    h.refresh.mockRejectedValueOnce(h.rejected);
    await expect(h.recovery.refresh(h.recovery.current())).rejects.toBe(h.rejected);
    expect(h.invalidate).toHaveBeenCalledTimes(1);
    const other = host();
    const before = other.recovery.current();
    other.switch();
    await other.recovery.invalidate(before);
    await expect(other.recovery.refresh(before)).rejects.toThrow('session has changed');
    expect(other.invalidate).not.toHaveBeenCalled();
  });

  it('a cancelled waiter does not cancel shared refresh or clear a session', async () => {
    const h = host();
    let fail!: (error: Error) => void;
    h.refresh.mockImplementationOnce(() => new Promise<string>((_, reject) => { fail = reject; }));
    const abort = new AbortController();
    const request = h.recovery.refresh(h.recovery.current(), abort.signal);
    const rejection = expect(request).rejects.toMatchObject({ name: 'AbortError' });
    await Promise.resolve();
    await Promise.resolve();
    abort.abort();
    await rejection;
    fail(h.rejected);
    await Promise.resolve();
    expect(h.invalidate).not.toHaveBeenCalled();
  });

  it('retries an eligible fetch once and expires a repeatedly rejected credential', async () => {
    const h = host();
    const transport = vi.fn(async (_request: Request) => new Response('{"code":40100}', { status: 401 }));
    const fetcher = createSessionFetch({ recovery: h.recovery, isAllowedRequest: (request) => new URL(request.url).origin === 'https://example.test',
      fetch: transport, isExpired: (response) => response.status === 401 });
    const response = await fetcher(new Request('https://example.test/api/items'));
    expect(response.status).toBe(401);
    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport.mock.calls[0]?.[0].headers.get('Authorization')).toBe('Bearer old');
    expect(transport.mock.calls[1]?.[0].headers.get('Authorization')).toBe('Bearer new');
    expect(h.invalidate).toHaveBeenCalledTimes(1);
  });

  it('rejects a foreign API origin before sending credentials', async () => {
    const h = host();
    const transport = vi.fn(async (_request: Request) => new Response(null));
    const fetcher = createSessionFetch({ recovery: h.recovery, fetch: transport,
      isAllowedRequest: (request) => new URL(request.url).origin === 'https://example.test',
      isExpired: (response) => response.status === 401 });
    await expect(fetcher(new Request('https://foreign.test/api/items'))).rejects.toThrow('origin or audience');
    expect(transport).not.toHaveBeenCalled();
  });

  it('does not refresh or expire a forbidden response', async () => {
    const h = host();
    const fetcher = createSessionFetch({ recovery: h.recovery, isAllowedRequest: () => true,
      fetch: async () => new Response(null, { status: 403 }), isExpired: (response) => response.status === 401 });
    expect((await fetcher(new Request('https://example.test/api/items'))).status).toBe(403);
    expect(h.refresh).not.toHaveBeenCalled();
    expect(h.invalidate).not.toHaveBeenCalled();
  });
});

const session = (token: string | null = 'token'): ClientSession => ({
  accessToken: vi.fn(() => token),
  clear: vi.fn(),
});

const successful = <T>(data: T): ClientDecodeResult<T> => ({
  kind: 'success',
  data,
});

const transportRequest = (
  transport: ClientTransport
): ClientTransportRequest => {
  const calls = vi.mocked(transport).mock.calls;
  const request = calls.at(-1)?.[0];
  if (request === undefined) throw new Error('transport was not called');
  return request;
};

describe('client request state machine', () => {
  it('stops an aborted request before transport and rejects a late transport result', async () => {
    const preAborted = new AbortController();
    preAborted.abort();
    const transport = vi.fn(async () => ({ ok: true }));
    const clientSession = session();
    const client = createClient({
      transport,
      session: clientSession,
      decoder: () => successful({ ok: true }),
    });
    await expect(client.request({ path: '/items', signal: preAborted.signal }))
      .rejects.toMatchObject({ name: 'AbortError' });
    expect(transport).not.toHaveBeenCalled();
    expect(clientSession.accessToken).not.toHaveBeenCalled();

    let release: ((value: unknown) => void) | undefined;
    transport.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const controller = new AbortController();
    const pending = client.request({ path: '/items', signal: controller.signal });
    expect(transportRequest(transport).signal).toBe(controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    release?.({ ok: true });
  });

  it('rejects unsafe paths before reading the session token', async () => {
    const clientSession = session();
    const transport = vi.fn(async () => ({ ok: true }));
    const client = createClient({
      transport,
      session: clientSession,
      decoder: () => successful({ ok: true }),
    });

    for (const path of [
      '',
      'https://other.test/items',
      ' https://other.test/items',
      '//other.test/items',
      '/items\\next',
      '/items\nnext',
      '/items/./next',
      '/items/../next',
    ]) {
      await expect(client.request({ path })).rejects.toMatchObject({
        kind: 'path',
        code: 'CLIENT_PATH_INVALID',
      });
    }
    expect(clientSession.accessToken).not.toHaveBeenCalled();
    expect(transport).not.toHaveBeenCalled();
  });

  it('strips caller authorization and adds one bearer token only for auth requests', async () => {
    const transport = vi.fn(async () => ({ ok: true }));
    const clientSession = session('access-token');
    const client = createClient({
      transport,
      session: clientSession,
      decoder: () => successful({ ok: true }),
    });

    await client.request({
      path: '/items',
      headers: {
        'Authorization': 'caller',
        'authorization': 'also-caller',
        'X-Test': 'yes',
      },
    });
    const secured = transportRequest(transport);
    expect(secured.headers.get('authorization')).toBe('Bearer access-token');
    expect(secured.headers.get('X-Test')).toBe('yes');

    await client.request({
      path: '/public',
      auth: false,
      headers: { Authorization: 'caller' },
    });
    expect(transportRequest(transport).headers.has('Authorization')).toBe(
      false
    );
  });

  it('returns decoded success data and maps business failures to stable errors', async () => {
    const businessHook = vi.fn();
    const client = createClient({
      transport: vi.fn(async () => ({ envelope: true })),
      session: session(),
      decoder: vi.fn((response: unknown) =>
        response instanceof Object && 'envelope' in response
          ? successful({ id: 'item-1' })
          : {
              kind: 'business' as const,
              code: 'ITEM_DENIED',
              message: 'Not allowed.',
            }
      ),
      hooks: { businessError: businessHook },
    });

    await expect(
      client.request<{ id: string }>({ path: '/items' })
    ).resolves.toEqual({ id: 'item-1' });

    const denied = createClient({
      transport: vi.fn(async () => null),
      session: session(),
      decoder: () => ({
        kind: 'business',
        code: 'ITEM_DENIED',
        message: 'Not allowed.',
      }),
      hooks: { businessError: businessHook },
    });
    await expect(denied.request({ path: '/items' })).rejects.toMatchObject({
      kind: 'business',
      code: 'ITEM_DENIED',
      message: 'Not allowed.',
    });
    expect(businessHook).toHaveBeenCalledOnce();
  });

  it('clears once before one unauthorized hook for concurrent failures', async () => {
    let releaseClear: (() => void) | undefined;
    const clear = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseClear = resolve;
        })
    );
    const unauthorizedHook = vi.fn();
    const client = createClient({
      transport: vi.fn(async () => ({ unauthorized: true })),
      session: { accessToken: vi.fn(() => 'token'), clear },
      decoder: () => ({
        kind: 'unauthorized',
        code: 'AUTH_EXPIRED',
        message: 'Sign in again.',
      }),
      hooks: { unauthorized: unauthorizedHook },
    });

    const first = client.request({ path: '/first' });
    const second = client.request({ path: '/second' });
    await vi.waitFor(() => expect(clear).toHaveBeenCalledOnce());
    expect(unauthorizedHook).not.toHaveBeenCalled();
    releaseClear?.();
    await expect(first).rejects.toMatchObject({
      kind: 'unauthorized',
      code: 'AUTH_EXPIRED',
    });
    await expect(second).rejects.toMatchObject({
      kind: 'unauthorized',
      code: 'AUTH_EXPIRED',
    });
    expect(unauthorizedHook).toHaveBeenCalledOnce();
    expect(clear.mock.invocationCallOrder[0]).toBeLessThan(
      unauthorizedHook.mock.invocationCallOrder[0] ?? Infinity
    );
  });

  it.each(['success', 'business', 'unauthorized'] as const)(
    'rejects a late %s response after the request session changes',
    async (kind) => {
      let token: string | null = 'old-token';
      let release: ((value: unknown) => void) | undefined;
      const clear = vi.fn();
      const unauthorized = vi.fn();
      const businessError = vi.fn();
      const client = createClient({
        transport: () => new Promise((resolve) => { release = resolve; }),
        session: { accessToken: () => token, clear },
        decoder: () => kind === 'success'
          ? successful({ tenant: 'old-tenant' })
          : { kind },
        hooks: { unauthorized, businessError },
      });
      const pending = client.request({ path: '/items' });
      token = 'new-token';
      release?.({});
      await expect(pending).rejects.toMatchObject({
        kind: 'session', code: 'CLIENT_SESSION_CHANGED',
      });
      expect(clear).not.toHaveBeenCalled();
      expect(unauthorized).not.toHaveBeenCalled();
      expect(businessError).not.toHaveBeenCalled();
      expect(token).toBe('new-token');
    }
  );

  it('preserves a new login during asynchronous clearing and handles its own unauthorized response', async () => {
    let token: string | null = 'old-token';
    let releaseClear: (() => void) | undefined;
    const clear = vi.fn(async (expectedToken?: string | null) => {
      if (expectedToken === 'old-token') {
        await new Promise<void>((resolve) => { releaseClear = resolve; });
      }
      if (token === expectedToken) token = null;
    });
    const unauthorized = vi.fn();
    const client = createClient({
      transport: async () => null,
      session: { accessToken: () => token, clear },
      decoder: () => ({ kind: 'unauthorized' }),
      hooks: { unauthorized },
    });
    const oldRequest = client.request({ path: '/old' });
    await vi.waitFor(() => expect(clear).toHaveBeenCalledWith('old-token'));
    token = 'new-token';
    releaseClear?.();
    await expect(oldRequest).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(token).toBe('new-token');
    expect(unauthorized).not.toHaveBeenCalled();

    await expect(client.request({ path: '/new' }))
      .rejects.toMatchObject({ kind: 'unauthorized' });
    expect(clear).toHaveBeenCalledWith('new-token');
    expect(token).toBeNull();
    expect(unauthorized).toHaveBeenCalledOnce();
  });

  it('does not clear or invoke the global unauthorized hook for a public request', async () => {
    const clientSession = session();
    const unauthorized = vi.fn();
    const client = createClient({
      transport: async () => null,
      session: clientSession,
      decoder: () => ({ kind: 'unauthorized' }),
      hooks: { unauthorized },
    });
    await expect(client.request({ path: '/public', auth: false }))
      .rejects.toMatchObject({ kind: 'unauthorized' });
    expect(clientSession.accessToken).not.toHaveBeenCalled();
    expect(clientSession.clear).not.toHaveBeenCalled();
    expect(unauthorized).not.toHaveBeenCalled();
  });

  it.each(['clear', 'token after clear'])(
    'fails closed without invoking the unauthorized hook when session %s fails',
    async (failure) => {
    const unauthorizedHook = vi.fn();
    let cleared = false;
    const client = createClient({
      transport: vi.fn(async () => null),
      session: {
        accessToken: vi.fn(() => {
          if (cleared) throw new Error('secret session failure');
          return 'token';
        }),
        clear: vi.fn(async () => {
          if (failure === 'clear') throw new Error('secret session failure');
          cleared = true;
        }),
      },
      decoder: () => ({ kind: 'unauthorized' }),
      hooks: { unauthorized: unauthorizedHook },
    });

    await expect(client.request({ path: '/items' })).rejects.toMatchObject({
      kind: 'session',
      code: 'CLIENT_SESSION_CLEAR_ERROR',
      message: 'The client session could not be cleared.',
    });
    expect(unauthorizedHook).not.toHaveBeenCalled();
    }
  );

  it('does not expose transport exceptions or malformed decoder values', async () => {
    const transportFailure = createClient({
      transport: vi.fn(async () => {
        throw new Error('token=secret raw response');
      }),
      session: session(),
      decoder: () => successful(null),
    });
    const transportError = await transportFailure
      .request({ path: '/items' })
      .catch((error) => error);
    expect(transportError).toBeInstanceOf(ClientRequestError);
    expect(transportError).toMatchObject({
      kind: 'transport',
      code: 'CLIENT_TRANSPORT_ERROR',
    });
    if (!(transportError instanceof ClientRequestError))
      throw new Error('expected ClientRequestError');
    expect(transportError.message).not.toContain('secret');

    const malformed = createClient({
      transport: vi.fn(async () => null),
      session: session(),
      decoder: () => ({ kind: 'unknown' } as never),
    });
    await expect(malformed.request({ path: '/items' })).rejects.toMatchObject({
      kind: 'decoder',
      code: 'CLIENT_DECODER_INVALID',
    });

    const undeclaredAlias = createClient({
      transport: vi.fn(async () => null),
      session: session(),
      decoder: () => ({ status: 'success', data: 'unexpected' } as never),
    });
    await expect(
      undeclaredAlias.request({ path: '/items' })
    ).rejects.toMatchObject({
      kind: 'decoder',
      code: 'CLIENT_DECODER_INVALID',
    });
  });
});

describe('client URL composition', () => {
  it('validates paths before composing an HTTP URL', () => {
    expect(
      resolveClientUrl('https://admin.example/base/', '/api/v1/items')
    ).toBe('https://admin.example/api/v1/items');
    try {
      resolveClientUrl('https://admin.example/', 'https://other.example/items');
      throw new Error('expected invalid path');
    } catch (error) {
      expect(error).toMatchObject({
        kind: 'path',
        code: 'CLIENT_PATH_INVALID',
      });
    }
    try {
      resolveClientUrl('https://user:secret@admin.example/', '/api');
      throw new Error('expected invalid base URL');
    } catch (error) {
      expect(error).toMatchObject({
        kind: 'path',
        code: 'CLIENT_BASE_URL_INVALID',
      });
    }
  });

  it('does not require browser Headers or URL globals', async () => {
    vi.stubGlobal('Headers', undefined);
    vi.stubGlobal('URL', undefined);
    try {
      const transport = vi.fn(async () => ({ ok: true }));
      const client = createClient({
        transport,
        session: session('portable-token'),
        decoder: () => successful({ ok: true }),
      });

      await client.request({
        path: '/items',
        headers: { 'X-Client': 'uniapp' },
      });
      const request = transportRequest(transport);
      expect(request.headers.get('authorization')).toBe(
        'Bearer portable-token'
      );
      expect(request.headers.get('x-client')).toBe('uniapp');
      expect(resolveClientUrl('https://admin.example/base/', 'items')).toBe(
        'https://admin.example/base/items'
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
