export interface RefreshAttempt {
  scope: string
  failedToken: string | null
  getAccessToken: () => string | null
  refresh: () => Promise<string | null>
}

export interface RefreshCoordinator {
  coordinate: (attempt: RefreshAttempt) => Promise<string | null>
}

export const createMemoryRefreshCoordinator = (): RefreshCoordinator => {
  const pending = new Map<string, Promise<string | null>>()

  return {
    async coordinate(attempt) {
      const current = attempt.getAccessToken()
      if (current !== null && current !== attempt.failedToken) return current

      let promise = pending.get(attempt.scope)
      if (promise === undefined) {
        promise = Promise.resolve()
          .then(attempt.refresh)
          .finally(() => pending.delete(attempt.scope))
        pending.set(attempt.scope, promise)
      }

      return promise
    },
  }
}

interface RefreshMessage {
  type: 'token' | 'token-request'
  token?: string
}

interface BrowserScopeState {
  channel: BroadcastChannel
  latestToken: string | null
  getters: Set<() => string | null>
}

const isRefreshMessage = (value: unknown): value is RefreshMessage => {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false
  const type = value.type
  if (type === 'token-request') return true
  return type === 'token' && 'token' in value && typeof value.token === 'string'
}

const waitForBroadcast = (): Promise<void> => new Promise(resolve => globalThis.setTimeout(resolve, 25))

export const createBrowserRefreshCoordinator = (): RefreshCoordinator => {
  const fallback = createMemoryRefreshCoordinator()
  const states = new Map<string, BrowserScopeState>()
  const canCoordinateTabs = typeof globalThis.BroadcastChannel === 'function'
    && typeof globalThis.navigator?.locks?.request === 'function'

  const stateFor = (scope: string): BrowserScopeState => {
    const existing = states.get(scope)
    if (existing !== undefined) return existing

    const state: BrowserScopeState = {
      channel: new BroadcastChannel(`peanut-admin:refresh:${scope}`),
      latestToken: null,
      getters: new Set(),
    }
    state.channel.addEventListener('message', (event: MessageEvent<unknown>) => {
      if (!isRefreshMessage(event.data)) return
      if (event.data.type === 'token') {
        state.latestToken = event.data.token ?? null
        return
      }
      if (state.latestToken !== null && state.latestToken !== '') {
        state.channel.postMessage({ type: 'token', token: state.latestToken } satisfies RefreshMessage)
        return
      }
      for (const getAccessToken of state.getters) {
        const token = getAccessToken()
        if (token !== null && token !== '') {
          state.channel.postMessage({ type: 'token', token } satisfies RefreshMessage)
          return
        }
      }
    })
    states.set(scope, state)

    return state
  }

  return {
    async coordinate(attempt) {
      if (!canCoordinateTabs) return fallback.coordinate(attempt)
      const state = stateFor(attempt.scope)
      state.getters.add(attempt.getAccessToken)

      return navigator.locks.request(`peanut-admin:refresh:${attempt.scope}`, async () => {
        const current = attempt.getAccessToken()
        if (current !== null && current !== attempt.failedToken) return current
        if (state.latestToken !== null && state.latestToken !== attempt.failedToken) {
          return state.latestToken
        }

        state.channel.postMessage({ type: 'token-request' } satisfies RefreshMessage)
        await waitForBroadcast()
        const afterRequest = attempt.getAccessToken()
        if (afterRequest !== null && afterRequest !== attempt.failedToken) return afterRequest
        if (state.latestToken !== null && state.latestToken !== attempt.failedToken) {
          return state.latestToken
        }

        const token = await attempt.refresh()
        if (token !== null && token !== '') {
          state.latestToken = token
          state.channel.postMessage({ type: 'token', token } satisfies RefreshMessage)
        }

        return token
      })
    },
  }
}
