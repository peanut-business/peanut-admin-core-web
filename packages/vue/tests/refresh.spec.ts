import { afterEach, describe, expect, it } from 'vitest';
import {
  createBrowserRefreshCoordinator,
  disposeTenantState,
} from '../src/index.js';

class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = [];
  closed = false;
  listeners = new Set<(event: MessageEvent<unknown>) => void>();

  constructor(public readonly name: string) {
    FakeBroadcastChannel.instances.push(this);
  }

  addEventListener(_type: string, listener: (event: MessageEvent<unknown>) => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: string, listener: (event: MessageEvent<unknown>) => void): void {
    this.listeners.delete(listener);
  }

  postMessage(_data: unknown): void {}

  close(): void {
    this.closed = true;
  }
}

describe('createBrowserRefreshCoordinator', () => {
  const originalBroadcastChannel = globalThis.BroadcastChannel;
  const originalLocks = (globalThis.navigator as { locks?: unknown } | undefined)?.locks;

  afterEach(() => {
    FakeBroadcastChannel.instances = [];
    Object.defineProperty(globalThis, 'BroadcastChannel', {
      value: originalBroadcastChannel,
      configurable: true,
      writable: true,
    });
    if (globalThis.navigator !== undefined) {
      Object.defineProperty(globalThis.navigator, 'locks', {
        value: originalLocks,
        configurable: true,
        writable: true,
      });
    }
  });

  it('closes BroadcastChannel and removes listeners on dispose and tenant state disposal', async () => {
    Object.defineProperty(globalThis, 'BroadcastChannel', {
      value: FakeBroadcastChannel,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis.navigator, 'locks', {
      value: {
        request: async <T>(_name: string, cb: () => Promise<T>) => cb(),
      },
      configurable: true,
      writable: true,
    });

    const coordinator = createBrowserRefreshCoordinator({
      tenantDisposerKey: 'test-refresh-coordinator',
    });

    const token = await coordinator.coordinate({
      scope: 'tenant-1',
      failedToken: 'old',
      getAccessToken: () => 'old',
      refresh: async () => 'fresh-token',
    });

    expect(token).toBe('fresh-token');
    expect(FakeBroadcastChannel.instances).toHaveLength(1);
    const channel = FakeBroadcastChannel.instances[0];
    expect(channel.closed).toBe(false);
    expect(channel.listeners.size).toBe(1);

    await disposeTenantState();
    expect(channel.closed).toBe(true);
    expect(channel.listeners.size).toBe(0);

    coordinator.dispose?.();
  });
});
