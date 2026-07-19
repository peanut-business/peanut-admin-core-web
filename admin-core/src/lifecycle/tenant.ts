export type TenantDisposer = () => void | Promise<void>

export interface TenantLifecycleTicket {
  generation: number
  signal: AbortSignal
  isCurrent: () => boolean
}

export interface TenantLifecycle {
  current: () => number
  capture: () => TenantLifecycleTicket
  invalidate: () => number
}

const tenantDisposers = new Map<string, TenantDisposer>()

export const registerTenantDisposer = (key: string, disposer: TenantDisposer): (() => void) => {
  if (key === '' || tenantDisposers.has(key)) {
    throw new Error(`TENANT_DISPOSER_DUPLICATE: ${key}`)
  }
  tenantDisposers.set(key, disposer)

  return () => {
    if (tenantDisposers.get(key) === disposer) {
      tenantDisposers.delete(key)
    }
  }
}

export const disposeTenantState = async (): Promise<void> => {
  const disposers = [...tenantDisposers.values()]
  const results = await Promise.allSettled(disposers.map(async disposer => disposer()))
  const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')
  if (failure !== undefined) throw failure.reason
}

export const createTenantLifecycle = (): TenantLifecycle => {
  let generation = 0
  let controller = new AbortController()

  return {
    current: () => generation,
    capture: () => {
      const capturedGeneration = generation
      const signal = controller.signal
      return {
        generation: capturedGeneration,
        signal,
        isCurrent: () => capturedGeneration === generation && !signal.aborted,
      }
    },
    invalidate: () => {
      controller.abort()
      controller = new AbortController()
      generation += 1
      return generation
    },
  }
}
