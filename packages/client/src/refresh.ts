export interface RefreshAttempt {
  scope: string;
  failedToken: string | null;
  getAccessToken: () => string | null;
  refresh: () => Promise<string | null>;
}

export interface RefreshCoordinator {
  coordinate: (attempt: RefreshAttempt) => Promise<string | null>;
}

export const createMemoryRefreshCoordinator = (): RefreshCoordinator => {
  const pending = new Map<string, Promise<string | null>>();
  return {
    async coordinate(attempt) {
      const current = attempt.getAccessToken();
      if (current !== null && current !== attempt.failedToken) return current;
      let promise = pending.get(attempt.scope);
      if (promise === undefined) {
        promise = Promise.resolve()
          .then(attempt.refresh)
          .finally(() => pending.delete(attempt.scope));
        pending.set(attempt.scope, promise);
      }
      return promise;
    },
  };
};
