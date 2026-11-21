import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSessionSync } from '../src/session-sync.js';

afterEach(() => vi.unstubAllGlobals());

function setupBrowser(useChannel: boolean) {
  const browser = new EventTarget();
  const channels: Channel[] = [];
  const storage = {
    setItem(key: string, newValue: string) {
      browser.dispatchEvent(Object.assign(new Event('storage'), {
        key, newValue, storageArea: storage,
      }));
    },
    removeItem: vi.fn(),
  };
  class Channel extends EventTarget {
    constructor(readonly name: string) {
      super();
      channels.push(this);
    }
    postMessage(data: unknown) {
      // Include the sender to exercise the origin check explicitly.
      for (const receiver of channels.filter((item) => item.name === this.name)) {
        receiver.dispatchEvent(new MessageEvent('message', { data }));
      }
    }
    close = vi.fn();
  }
  vi.stubGlobal('window', Object.assign(browser, { crypto, localStorage: storage }));
  vi.stubGlobal('BroadcastChannel', useChannel ? Channel : undefined);
  return { browser, channels, storage };
}

describe('createSessionSync', () => {
  it.each([true, false])('delivers credential-free events and isolates namespaces (channel=%s)', (useChannel) => {
    const { storage } = setupBrowser(useChannel);
    const self = vi.fn();
    const received = vi.fn();
    const otherNamespace = vi.fn();
    const a = createSessionSync('web', self);
    const b = createSessionSync('web', received);
    const platform = createSessionSync('platform', otherNamespace);
    for (const type of ['logout', 'tenant-switched', 'session-refreshed', 'session-refreshed'] as const) a.publish(type);
    const sender = received.mock.calls[0]?.[0].originTabId;
    expect(typeof sender).toBe('string');
    expect(received.mock.calls.map(([event]) => event)).toEqual(
      ['logout', 'tenant-switched', 'session-refreshed', 'session-refreshed'].map((type) => ({ type, originTabId: sender }))
    );
    expect(self).not.toHaveBeenCalled();
    expect(otherNamespace).not.toHaveBeenCalled();
    expect(storage.removeItem).toHaveBeenCalledTimes(useChannel ? 0 : 4);
    b.dispose();
    a.publish('logout');
    expect(received).toHaveBeenCalledTimes(4);
    a.dispose();
    platform.dispose();
  });

  it('ignores malformed storage events and foreign storage areas', () => {
    const { browser, storage } = setupBrowser(false);
    const listener = vi.fn();
    const sync = createSessionSync('web', listener);
    storage.setItem('peanut:session-sync:web', 'bad json');
    storage.setItem('peanut:session-sync:web', '{"type":"unknown","originTabId":"other"}');
    browser.dispatchEvent(Object.assign(new Event('storage'), {
      key: 'peanut:session-sync:web',
      newValue: '{"type":"logout","originTabId":"other"}',
      storageArea: {},
    }));
    expect(listener).not.toHaveBeenCalled();
    sync.dispose();
  });

  it('falls back when the browser denies opening a BroadcastChannel', () => {
    const { storage } = setupBrowser(true);
    vi.stubGlobal('BroadcastChannel', class { constructor() { throw new Error('denied'); } });
    const sync = createSessionSync('web', vi.fn());
    sync.publish('logout');
    expect(storage.removeItem).toHaveBeenCalledOnce();
    sync.dispose();
  });

  it('does nothing during SSR', () => {
    const listener = vi.fn();
    const sync = createSessionSync('web', listener);
    sync.publish('logout');
    sync.dispose();
    expect(listener).not.toHaveBeenCalled();
  });
});
