import { createMemoryRefreshCoordinator } from './refresh.js';

export interface SessionSnapshot {
  readonly generation: number;
  readonly token: string | null;
}

export interface SessionRecoveryOptions {
  readonly current: () => SessionSnapshot;
  readonly isRefreshable: (token: string | null) => boolean;
  readonly refresh: (snapshot: SessionSnapshot) => Promise<string>;
  /** True only for a definitive credential rejection, never a network failure. */
  readonly isRefreshRejected: (error: unknown) => boolean;
  /** Clear local state and navigate; recheck the snapshot before committing. */
  readonly invalidate: (snapshot: SessionSnapshot) => Promise<void>;
}

type RequestSignal = Pick<
  AbortSignal,
  'aborted' | 'addEventListener' | 'removeEventListener'
> & { readonly reason?: unknown };

const changed = () => new Error('The request session has changed.');
const aborted = (signal: RequestSignal) =>
  signal.reason ??
  Object.assign(new Error('The request was aborted.'), { name: 'AbortError' });

function checkSignal(signal?: RequestSignal): void {
  if (signal?.aborted) {
    throw aborted(signal);
  }
}

function awaitRefresh(
  pending: Promise<string>,
  signal?: RequestSignal
): Promise<string> {
  if (!signal) return pending;
  checkSignal(signal);
  return new Promise((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener('abort', abort);
      reject(aborted(signal));
    };
    signal.addEventListener('abort', abort, { once: true });
    pending.then(
      (token) => {
        signal.removeEventListener('abort', abort);
        resolve(token);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', abort);
        reject(error);
      }
    );
  });
}

/** One instance per host session, shared by its Axios and fetch adapters. */
export function createSessionRecovery(options: SessionRecoveryOptions) {
  const refreshes = createMemoryRefreshCoordinator();
  const invalidations = new Map<string, Promise<void>>();
  const key = (snapshot: SessionSnapshot) =>
    JSON.stringify([snapshot.generation, snapshot.token]);
  const assertCurrent = (
    snapshot: SessionSnapshot,
    token = snapshot.token
  ): void => {
    const current = options.current();
    if (current.generation !== snapshot.generation || current.token !== token)
      throw changed();
  };
  const invalidate = async (snapshot: SessionSnapshot): Promise<void> => {
    const current = options.current();
    if (
      snapshot.token === null ||
      current.generation !== snapshot.generation ||
      current.token !== snapshot.token
    )
      return;
    const identity = key(snapshot);
    let pending = invalidations.get(identity);
    if (!pending) {
      pending = Promise.resolve()
        .then(() => {
          assertCurrent(snapshot);
          return options.invalidate(snapshot);
        })
        .finally(() => invalidations.delete(identity));
      invalidations.set(identity, pending);
    }
    await pending;
  };
  const refresh = async (
    snapshot: SessionSnapshot,
    signal?: RequestSignal
  ): Promise<string> => {
    checkSignal(signal);
    const current = options.current();
    if (
      current.generation !== snapshot.generation ||
      !options.isRefreshable(snapshot.token)
    )
      throw changed();
    if (current.token !== snapshot.token) {
      if (current.token !== null && options.isRefreshable(current.token))
        return current.token;
      throw changed();
    }
    const identity = key(snapshot);
    const pending = refreshes
      .coordinate({
        scope: identity,
        failedToken: snapshot.token,
        getAccessToken: () => {
          const latest = options.current();
          return latest.generation === snapshot.generation
            ? latest.token
            : null;
        },
        refresh: () => {
          assertCurrent(snapshot);
          return options.refresh(snapshot);
        },
      })
      .then((token) => {
        if (token === null) throw changed();
        return token;
      });
    let token: string;
    try {
      token = await awaitRefresh(pending, signal);
    } catch (error) {
      checkSignal(signal);
      const latest = options.current();
      if (
        latest.generation === snapshot.generation &&
        latest.token !== snapshot.token &&
        latest.token !== null &&
        options.isRefreshable(latest.token)
      )
        return latest.token;
      if (options.isRefreshRejected(error)) await invalidate(snapshot);
      throw error;
    }
    checkSignal(signal);
    const latest = options.current();
    if (latest.generation !== snapshot.generation) throw changed();
    if (latest.token === token) return token;
    if (latest.token !== null && options.isRefreshable(latest.token))
      return latest.token;
    throw changed();
  };
  return {
    current: options.current,
    isRefreshable: options.isRefreshable,
    assertCurrent,
    refresh,
    invalidate,
  };
}

export type SessionRecovery = ReturnType<typeof createSessionRecovery>;

export interface SessionFetchOptions {
  readonly recovery: SessionRecovery;
  /** Validate the trusted API origin and audience path before attaching a bearer. */
  readonly isAllowedRequest: (request: Request) => boolean;
  /** Only classify routes whose authentication rejection occurs before business execution. */
  readonly isExpired: (
    response: Response,
    request: Request
  ) => boolean | Promise<boolean>;
  readonly fetch?: (request: Request) => Promise<Response>;
}

/** Adds the current bearer and replays an explicitly eligible request at most once. */
export function createSessionFetch(options: SessionFetchOptions) {
  const transport = options.fetch ?? ((request: Request) => fetch(request));
  const authorized = (request: Request, token: string | null) => {
    const headers = new Headers(request.headers);
    headers.delete('Authorization');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return new Request(request, { headers });
  };
  return async (request: Request): Promise<Response> => {
    const { recovery } = options;
    if (!options.isAllowedRequest(request))
      throw new Error('The request API origin or audience is invalid.');
    const snapshot = recovery.current();
    checkSignal(request.signal);
    recovery.assertCurrent(snapshot);
    let replay: Request | null = null;
    try {
      replay = request.clone();
    } catch {
      /* Unreplayable bodies are sent only once. */
    }
    const response = await transport(authorized(request, snapshot.token));
    checkSignal(request.signal);
    const expired = await options.isExpired(response, request);
    checkSignal(request.signal);
    if (!expired) {
      recovery.assertCurrent(snapshot);
      return response;
    }
    if (!recovery.isRefreshable(snapshot.token)) {
      recovery.assertCurrent(snapshot);
      await recovery.invalidate(snapshot);
      return response;
    }
    const token = await recovery.refresh(snapshot, request.signal);
    checkSignal(request.signal);
    recovery.assertCurrent(snapshot, token);
    if (replay === null) return response;
    const retried = await transport(authorized(replay, token));
    checkSignal(request.signal);
    recovery.assertCurrent(snapshot, token);
    const stillExpired = await options.isExpired(retried, request);
    checkSignal(request.signal);
    recovery.assertCurrent(snapshot, token);
    if (stillExpired) await recovery.invalidate({ ...snapshot, token });
    else recovery.assertCurrent(snapshot, token);
    return retried;
  };
}
