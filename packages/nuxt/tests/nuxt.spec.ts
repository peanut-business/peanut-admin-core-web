import { describe, expect, it, vi } from 'vitest';

import {
  createNuxtClientTransport,
  createNuxtSsrForwardHeaders,
} from '../src/index';
import type { ClientHeaders } from '../../client/src/index';

const headers = (values: Record<string, string> = {}): ClientHeaders => {
  const normalized = new Map(
    Object.entries(values).map(([key, value]) => [key.toLowerCase(), value])
  );
  return {
    delete: (name) => {
      normalized.delete(name.toLowerCase());
    },
    get: (name) => normalized.get(name.toLowerCase()) ?? null,
    has: (name) => normalized.has(name.toLowerCase()),
    set: (name, value) => {
      normalized.set(name.toLowerCase(), value);
    },
    forEach: (callback) =>
      normalized.forEach((value, key) => callback(value, key)),
  };
};

describe('Nuxt client transport', () => {
  it('maps GET and DELETE data to query and other methods to body', async () => {
    const calls: Array<{ url: string; options?: unknown }> = [];
    const fetcher = vi.fn(async (url: string, options?: unknown) => {
      calls.push({ url, options });
      return { ok: true };
    });
    const transport = createNuxtClientTransport({
      baseUrl: 'https://admin.example/',
      $fetch: fetcher,
    });
    const requestHeaders = headers({ Authorization: 'Bearer token' });

    await transport({
      path: '/items',
      method: 'GET',
      data: { page: 2 },
      headers: requestHeaders,
    });
    await transport({
      path: '/items/1',
      method: 'DELETE',
      data: { revision: 3 },
      headers: requestHeaders,
    });
    await transport({
      path: '/items',
      method: 'POST',
      data: { name: 'item' },
      headers: requestHeaders,
    });

    expect(calls).toHaveLength(3);
    expect(calls[0]).toMatchObject({ url: 'https://admin.example/items' });
    expect(calls[0]?.options).toMatchObject({
      method: 'GET',
      query: { page: 2 },
      headers: { authorization: 'Bearer token' },
    });
    expect(calls[1]?.options).toMatchObject({
      method: 'DELETE',
      query: { revision: 3 },
      headers: { authorization: 'Bearer token' },
    });
    expect(calls[2]?.options).toMatchObject({
      method: 'POST',
      body: { name: 'item' },
      headers: { authorization: 'Bearer token' },
    });
    expect(calls[2]?.options).not.toHaveProperty('query');
  });

  it('rejects invalid path before calling the fetch function', async () => {
    const fetcher = vi.fn(async () => ({}));
    const transport = createNuxtClientTransport({
      baseUrl: 'https://admin.example/',
      $fetch: fetcher,
    });

    await expect(
      transport({
        path: '//other.example/items',
        method: 'GET',
        headers: headers(),
      })
    ).rejects.toMatchObject({
      kind: 'path',
      code: 'CLIENT_PATH_INVALID',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('forwards only normalized trusted SSR authority and cookie context', async () => {
    const fetcher = vi.fn(async () => ({}));
    const forwardHeaders = createNuxtSsrForwardHeaders({
      requestHost: 'Tenant-A.Example.test:8443',
      cookie: 'member_session=opaque',
      forwardedProto: 'https',
      trustedHosts: ['*.example.test'],
    });
    const transport = createNuxtClientTransport({
      baseUrl: 'http://internal-gateway/',
      $fetch: fetcher,
      forwardHeaders,
    });

    await transport({
      path: '/api/articles',
      method: 'GET',
      headers: headers({ Host: 'attacker.test' }),
    });

    expect(fetcher).toHaveBeenCalledWith(
      'http://internal-gateway/api/articles',
      expect.objectContaining({
        headers: expect.objectContaining({
          'host': 'tenant-a.example.test:8443',
          'cookie': 'member_session=opaque',
          'x-forwarded-host': 'tenant-a.example.test:8443',
          'x-forwarded-proto': 'https',
        }),
      })
    );
  });

  it('rejects untrusted or malformed SSR forwarding context', () => {
    expect(() =>
      createNuxtSsrForwardHeaders({
        requestHost: 'tenant.example.test',
        forwardedProto: 'https',
        trustedHosts: ['*.trusted.test'],
      })
    ).toThrow('NUXT_SSR_FORWARD_CONTEXT_INVALID');
    expect(() =>
      createNuxtSsrForwardHeaders({
        requestHost: 'tenant.example.test',
        cookie: 'session=ok\r\nX-Leak: value',
        forwardedProto: 'https',
      })
    ).toThrow('NUXT_SSR_FORWARD_CONTEXT_INVALID');
  });
});
