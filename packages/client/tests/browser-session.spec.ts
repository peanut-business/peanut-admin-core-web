import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  createPlatformSession,
  formatRequestError,
  newBrowserSessionIdentity,
  readBrowserSession,
  writeBrowserSession,
} from '@peanut-admin/client';

beforeEach(() => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  };
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', Object.assign(new EventTarget(), { localStorage: storage, crypto }));
  vi.stubGlobal('BroadcastChannel', undefined);
  vi.stubGlobal('navigator', {});
});
afterEach(() => vi.unstubAllGlobals());

it('reads legacy session keys and writes identity and bearer together', () => {
  localStorage.setItem('identity', 'legacy-identity');
  localStorage.setItem('token', 'legacy-token');
  expect(readBrowserSession('session', 'token', 'identity')).toEqual({
    identity: 'legacy-identity', token: 'legacy-token',
  });

  const identity = newBrowserSessionIdentity();
  expect(identity).toMatch(/^[a-f0-9]{32}$/);
  writeBrowserSession('session', 'token', { identity, token: 'new-token' });
  expect(readBrowserSession('session', 'token', 'identity')).toEqual({
    identity, token: 'new-token',
  });
  expect(localStorage.getItem('token')).toBeNull();
  expect(localStorage.getItem('identity')).toBe('legacy-identity');
});

it('rejects corrupted session state without exposing a legacy bearer', () => {
  localStorage.setItem('token', 'legacy-token');
  for (const value of ['{broken', '{"identity":"old","token":7}']) {
    localStorage.setItem('session', value);
    expect(readBrowserSession('session', 'token')).toEqual({
      identity: null, token: null,
    });
  }
});

it('uses only valid response trace IDs and hides server error text', () => {
  expect(formatRequestError('Network unavailable')).toBe('Network unavailable');
  expect(formatRequestError('Forbidden', {
    status: 403, headers: { 'X-Trace-ID': 'trace-403' },
  })).toBe('Forbidden（追踪 ID：trace-403）');
  expect(formatRequestError('Private server details', {
    status: 503, headers: { 'x-trace-id': 'trace-503' },
  })).toBe('服务暂时不可用，请稍后重试（追踪 ID：trace-503）');
  expect(formatRequestError('Private server details', {
    status: 500, headers: { 'x-trace-id': 'invalid\n' },
  })).toBe('服务暂时不可用，请稍后重试');
});

it('rotates a bearer within the current identity and rejects stale sessions', async () => {
  const current = createPlatformSession(() => {});
  const stale = createPlatformSession(() => {});
  try {
    current.setToken('first');
    const initial = current.current();
    const request = vi.fn((_name: string, run: () => Promise<void>) => run());
    vi.stubGlobal('navigator', { locks: { request } });
    await current.withCookieLock(async () => current.setToken('rotated', false), initial, true);
    expect(request).toHaveBeenCalledWith('peanut-platform-session-cookie', expect.any(Function));
    expect(current.sameIdentity(initial)).toBe(true);
    expect(current.matches(initial)).toBe(false);
    expect(current.current().token).toBe('rotated');
    expect(stale.current().token).toBeNull();
    expect(() => stale.setToken(null)).toThrow('The platform session has changed.');

    const operation = vi.fn(async () => {});
    await expect(stale.withCookieLock(operation, stale.current())).rejects.toThrow('The platform session has changed.');
    expect(operation).not.toHaveBeenCalled();
  } finally {
    current.dispose();
    stale.dispose();
  }
});

it('requires Web Locks for a refresh and keeps the local queue usable afterwards', async () => {
  const session = createPlatformSession(() => {});
  try {
    const operation = vi.fn(async () => 'done');
    const snapshot = session.current();
    await expect(session.withCookieLock(operation, snapshot, true)).rejects.toThrow('requires Web Locks');
    expect(operation).not.toHaveBeenCalled();
    await expect(session.withCookieLock(operation, snapshot)).resolves.toBe('done');
  } finally {
    session.dispose();
  }
});
