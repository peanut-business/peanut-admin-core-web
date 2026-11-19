export type AbortableSignal = Pick<
  AbortSignal,
  'aborted' | 'addEventListener' | 'removeEventListener'
> & { readonly reason?: unknown };

/** Races a promise against an AbortSignal and cleans up listeners upon completion. */
export const raceAbortSignal = async <T>(
  promise: Promise<T>,
  signal?: AbortableSignal,
  createAbortError?: (signal: AbortableSignal) => unknown
): Promise<T> => {
  if (signal === undefined) return promise;
  const toError =
    createAbortError ??
    ((sig: AbortableSignal) =>
      sig.reason ??
      Object.assign(new Error('The request was aborted.'), {
        name: 'AbortError',
      }));
  if (signal.aborted) {
    throw toError(signal);
  }
  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      cleanup();
      reject(toError(signal));
    };
    const cleanup = () => signal.removeEventListener('abort', abort);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }
    promise.then(
      (result) => {
        cleanup();
        if (signal.aborted) reject(toError(signal));
        else resolve(result);
      },
      (error) => {
        cleanup();
        if (signal.aborted) reject(toError(signal));
        else reject(error);
      }
    );
  });
};

export interface SingleFlight<T = unknown> {
  run: <TResult extends T = T>(
    key: string,
    loader: () => Promise<TResult>
  ) => Promise<TResult>;
  has: (key: string) => boolean;
  clear: () => void;
}

/** Deduplicates concurrent async operations sharing the same key. */
export const createSingleFlight = <T = unknown>(): SingleFlight<T> => {
  const inflight = new Map<string, Promise<T>>();

  return {
    run<TResult extends T = T>(
      key: string,
      loader: () => Promise<TResult>
    ): Promise<TResult> {
      const existing = inflight.get(key);
      if (existing !== undefined) {
        return existing as Promise<TResult>;
      }
      const promise = Promise.resolve()
        .then(loader)
        .finally(() => {
          if (inflight.get(key) === promise) {
            inflight.delete(key);
          }
        });
      inflight.set(key, promise);
      return promise;
    },
    has: (key) => inflight.has(key),
    clear: () => {
      inflight.clear();
    },
  };
};

export interface ConcurrentPageResult<TItem> {
  items: readonly TItem[];
  total: number;
}

export interface FetchAllPagesOptions<TItem> {
  pageSize: number;
  concurrency?: number;
  maxPages?: number;
  signal?: AbortSignal;
  isCurrent?: () => boolean;
  validateTotalConsistency?: boolean;
  fetchPage: (pageNo: number, pageSize: number) => Promise<ConcurrentPageResult<TItem>>;
}

export interface FetchAllPagesOutcome<TItem> {
  items: TItem[];
  total: number;
  pagesFetched: number;
  truncated: boolean;
  aborted: boolean;
}

/**
 * Fetches page 1 to discover total count, then fetches remaining pages
 * with bounded concurrency and optional stale/abort guards.
 */
export const fetchAllPagesConcurrently = async <TItem>(
  options: FetchAllPagesOptions<TItem>
): Promise<FetchAllPagesOutcome<TItem>> => {
  const pageSize = Math.max(1, Math.floor(options.pageSize));
  const concurrency = Math.max(1, Math.min(16, Math.floor(options.concurrency ?? 4)));
  const maxPages = Math.max(1, Math.floor(options.maxPages ?? 100));
  const isCurrent = options.isCurrent ?? (() => true);

  const isStopped = (): boolean => Boolean(options.signal?.aborted) || !isCurrent();

  if (isStopped()) {
    return { items: [], total: 0, pagesFetched: 0, truncated: false, aborted: true };
  }

  const first = await options.fetchPage(1, pageSize);
  if (isStopped()) {
    return { items: [], total: first.total, pagesFetched: 1, truncated: false, aborted: true };
  }

  const total = Math.max(0, Math.floor(first.total));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const targetPages = Math.min(totalPages, maxPages);
  const truncated = totalPages > maxPages;

  if (targetPages === 1) {
    return {
      items: [...first.items],
      total,
      pagesFetched: 1,
      truncated,
      aborted: false,
    };
  }

  const pageBuckets: Array<readonly TItem[]> = new Array(targetPages);
  pageBuckets[0] = first.items;

  let nextPage = 2;
  let pagesFetched = 1;
  let stopped = false;

  const worker = async (): Promise<void> => {
    while (!stopped) {
      if (isStopped()) {
        stopped = true;
        return;
      }
      const pageNo = nextPage;
      if (pageNo > targetPages) {
        return;
      }
      nextPage += 1;

      const page = await options.fetchPage(pageNo, pageSize);
      if (isStopped()) {
        stopped = true;
        return;
      }
      if (options.validateTotalConsistency && page.total !== total) {
        throw new Error(
          `CONCURRENT_PAGE_TOTAL_CHANGED: expected ${total}, got ${page.total} at page ${pageNo}`
        );
      }
      pageBuckets[pageNo - 1] = page.items;
      pagesFetched += 1;
    }
  };

  const workerCount = Math.min(concurrency, targetPages - 1);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  if (stopped || isStopped()) {
    return { items: [], total, pagesFetched, truncated, aborted: true };
  }

  const items: TItem[] = [];
  for (const bucket of pageBuckets) {
    if (bucket !== undefined) {
      items.push(...bucket);
    }
  }

  return { items, total, pagesFetched, truncated, aborted: false };
};

export interface RevisionedRequestCacheOptions {
  ttlMs?: number;
  maxEntries?: number;
  now?: () => number;
}

export interface RevisionedRequestCache<T = unknown> {
  getOrLoad: <TResult extends T = T>(
    scopeKey: string,
    key: string,
    loader: () => Promise<TResult>,
    ttlMs?: number
  ) => Promise<TResult>;
  get: <TResult extends T = T>(scopeKey: string, key: string) => TResult | undefined;
  invalidateScope: (scopeKey: string) => void;
  invalidateKey: (scopeKey: string, key: string) => void;
  clear: () => void;
  size: () => number;
}

interface CacheEntry<T> {
  scopeKey: string;
  value: T;
  expiresAt: number;
}

/**
 * Bounded TTL request cache keyed by `(scopeKey, key)` with built-in single-flight
 * deduplication. Callers should include tenantId and authorizationRevision in `scopeKey`.
 */
export const createRevisionedRequestCache = <T = unknown>(
  options: RevisionedRequestCacheOptions = {}
): RevisionedRequestCache<T> => {
  const defaultTtlMs = Math.max(0, options.ttlMs ?? 30_000);
  const maxEntries = Math.max(1, Math.floor(options.maxEntries ?? 256));
  const now = options.now ?? (() => Date.now());
  const entries = new Map<string, CacheEntry<T>>();
  const singleFlight = createSingleFlight<T>();

  const compositeKey = (scopeKey: string, key: string): string =>
    `${scopeKey}\0${key}`;

  const evictIfNeeded = (): void => {
    const currentTime = now();
    for (const [k, entry] of entries) {
      if (entry.expiresAt <= currentTime) {
        entries.delete(k);
      }
    }
    while (entries.size >= maxEntries) {
      const oldestKey = entries.keys().next().value;
      if (oldestKey === undefined) break;
      entries.delete(oldestKey);
    }
  };

  const readValid = <TResult extends T = T>(
    scopeKey: string,
    key: string
  ): TResult | undefined => {
    const fullKey = compositeKey(scopeKey, key);
    const entry = entries.get(fullKey);
    if (entry === undefined) return undefined;
    if (entry.expiresAt <= now()) {
      entries.delete(fullKey);
      return undefined;
    }
    return entry.value as TResult;
  };

  return {
    get: readValid,
    async getOrLoad<TResult extends T = T>(
      scopeKey: string,
      key: string,
      loader: () => Promise<TResult>,
      ttlMs = defaultTtlMs
    ): Promise<TResult> {
      const cached = readValid<TResult>(scopeKey, key);
      if (cached !== undefined) {
        return cached;
      }
      const fullKey = compositeKey(scopeKey, key);
      return singleFlight.run(fullKey, async () => {
        const rechecked = readValid<TResult>(scopeKey, key);
        if (rechecked !== undefined) {
          return rechecked;
        }
        const value = await loader();
        if (ttlMs > 0) {
          evictIfNeeded();
          entries.set(fullKey, {
            scopeKey,
            value,
            expiresAt: now() + ttlMs,
          });
        }
        return value;
      });
    },
    invalidateScope(scopeKey) {
      for (const [k, entry] of entries) {
        if (entry.scopeKey === scopeKey) {
          entries.delete(k);
        }
      }
    },
    invalidateKey(scopeKey, key) {
      entries.delete(compositeKey(scopeKey, key));
    },
    clear() {
      entries.clear();
      singleFlight.clear();
    },
    size: () => entries.size,
  };
};
