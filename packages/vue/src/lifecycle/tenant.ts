export type TenantDisposer = () => void | Promise<void>;

export interface TenantLifecycleTicket {
  generation: number;
  signal: AbortSignal;
  isCurrent: () => boolean;
}

export interface TenantLifecycle {
  current: () => number;
  capture: () => TenantLifecycleTicket;
  invalidate: () => number;
}

const tenantDisposers = new Map<string, TenantDisposer>();

/** Registers a unique callback for discarding tenant-owned state. */
export const registerTenantDisposer = (
  key: string,
  disposer: TenantDisposer
): (() => void) => {
  if (key === '' || tenantDisposers.has(key)) {
    throw new Error(`TENANT_DISPOSER_DUPLICATE: ${key}`);
  }
  tenantDisposers.set(key, disposer);

  return () => {
    if (tenantDisposers.get(key) === disposer) {
      tenantDisposers.delete(key);
    }
  };
};

/** Runs all registered cleanups, then propagates the first failure, if any. */
export const disposeTenantState = async (): Promise<void> => {
  const disposers = [...tenantDisposers.values()];
  const results = await Promise.allSettled(
    disposers.map(async (disposer) => disposer())
  );
  const failure = results.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected'
  );
  if (failure !== undefined) throw failure.reason;
};

/**
 * Creates generation tickets that reject late results after tenant changes.
 */
export const createTenantLifecycle = (): TenantLifecycle => {
  let generation = 0;
  let controller = new AbortController();

  return {
    current: () => generation,
    capture: () => {
      const capturedGeneration = generation;
      const signal = controller.signal;
      return {
        generation: capturedGeneration,
        signal,
        isCurrent: () => capturedGeneration === generation && !signal.aborted,
      };
    },
    invalidate: () => {
      controller.abort();
      controller = new AbortController();
      generation += 1;
      return generation;
    },
  };
};
