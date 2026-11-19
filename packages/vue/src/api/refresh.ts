import { createMemoryRefreshCoordinator } from '@peanut-admin/client';
import type { RefreshAttempt, RefreshCoordinator } from '@peanut-admin/client';
import { registerTenantDisposer } from '../lifecycle/tenant.js';
export { createMemoryRefreshCoordinator };
export type { RefreshAttempt, RefreshCoordinator };

interface RefreshMessage {
  type: 'token' | 'token-request';
  token?: string;
}

interface BrowserScopeState {
  channel: BroadcastChannel;
  listener: (event: MessageEvent<unknown>) => void;
  latestToken: string | null;
  getters: Set<() => string | null>;
}

export interface BrowserRefreshCoordinatorOptions {
  /** Optional key used to auto-register cleanup with `registerTenantDisposer`. */
  tenantDisposerKey?: string;
}

const isRefreshMessage = (value: unknown): value is RefreshMessage => {
  if (typeof value !== 'object' || value === null || !('type' in value))
    return false;
  const type = value.type;
  if (type === 'token-request') return true;
  return (
    type === 'token' && 'token' in value && typeof value.token === 'string'
  );
};

const waitForBroadcast = (): Promise<void> =>
  new Promise((resolve) => globalThis.setTimeout(resolve, 25));

export const createBrowserRefreshCoordinator = (
  options: BrowserRefreshCoordinatorOptions = {}
): RefreshCoordinator => {
  const fallback = createMemoryRefreshCoordinator();
  const states = new Map<string, BrowserScopeState>();
  const canCoordinateTabs =
    typeof globalThis.BroadcastChannel === 'function' &&
    typeof globalThis.navigator?.locks?.request === 'function';

  const closeState = (state: BrowserScopeState): void => {
    state.channel.removeEventListener('message', state.listener);
    state.channel.close();
    state.latestToken = null;
    state.getters.clear();
  };

  const stateFor = (scope: string): BrowserScopeState => {
    const existing = states.get(scope);
    if (existing !== undefined) return existing;

    const channel = new BroadcastChannel(`peanut-admin:refresh:${scope}`);
    const state: BrowserScopeState = {
      channel,
      listener: () => {},
      latestToken: null,
      getters: new Set(),
    };
    const listener = (event: MessageEvent<unknown>): void => {
      if (!isRefreshMessage(event.data)) return;
      if (event.data.type === 'token') {
        state.latestToken = event.data.token ?? null;
        return;
      }
      if (state.latestToken !== null && state.latestToken !== '') {
        state.channel.postMessage({
          type: 'token',
          token: state.latestToken,
        } satisfies RefreshMessage);
        return;
      }
      for (const getAccessToken of state.getters) {
        const token = getAccessToken();
        if (token !== null && token !== '') {
          state.channel.postMessage({
            type: 'token',
            token,
          } satisfies RefreshMessage);
          return;
        }
      }
    };
    state.listener = listener;
    channel.addEventListener('message', listener);
    states.set(scope, state);

    return state;
  };

  let unregisterTenantDisposer: (() => void) | null = null;

  const dispose = (): void => {
    for (const state of states.values()) {
      closeState(state);
    }
    states.clear();
    fallback.dispose?.();
    if (unregisterTenantDisposer !== null) {
      unregisterTenantDisposer();
      unregisterTenantDisposer = null;
    }
  };

  if (options.tenantDisposerKey !== undefined && options.tenantDisposerKey !== '') {
    unregisterTenantDisposer = registerTenantDisposer(options.tenantDisposerKey, () => {
      for (const state of states.values()) {
        closeState(state);
      }
      states.clear();
      fallback.dispose?.();
    });
  }

  return {
    async coordinate(attempt) {
      if (!canCoordinateTabs) return fallback.coordinate(attempt);
      const state = stateFor(attempt.scope);
      state.getters.add(attempt.getAccessToken);

      try {
        return await navigator.locks.request(
          `peanut-admin:refresh:${attempt.scope}`,
          async () => {
            const current = attempt.getAccessToken();
            if (current !== null && current !== attempt.failedToken)
              return current;
            if (
              state.latestToken !== null &&
              state.latestToken !== attempt.failedToken
            ) {
              return state.latestToken;
            }

            state.channel.postMessage({
              type: 'token-request',
            } satisfies RefreshMessage);
            await waitForBroadcast();
            const afterRequest = attempt.getAccessToken();
            if (afterRequest !== null && afterRequest !== attempt.failedToken)
              return afterRequest;
            if (
              state.latestToken !== null &&
              state.latestToken !== attempt.failedToken
            ) {
              return state.latestToken;
            }

            const token = await attempt.refresh();
            if (token !== null && token !== '') {
              state.latestToken = token;
              state.channel.postMessage({
                type: 'token',
                token,
              } satisfies RefreshMessage);
            }

            return token;
          }
        );
      } finally {
        state.getters.delete(attempt.getAccessToken);
      }
    },
    clearScope(scope) {
      const state = states.get(scope);
      if (state !== undefined) {
        closeState(state);
        states.delete(scope);
      }
      fallback.clearScope?.(scope);
    },
    dispose,
  };
};
