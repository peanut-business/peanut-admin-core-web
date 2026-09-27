import { onScopeDispose, ref, type Ref } from 'vue';

import { createTenantLifecycle } from '../lifecycle/tenant.js';

export type AsyncActionResult<TData> =
  | { readonly status: 'completed'; readonly data: TData }
  | { readonly status: 'cancelled' }
  | { readonly status: 'failed'; readonly error: string }
  | { readonly status: 'busy' };

export interface AsyncActionState {
  readonly loading: Ref<boolean>;
  readonly error: Ref<string | null>;
  run: <TData>(
    action: (context: { readonly signal: AbortSignal }) => Promise<TData>
  ) => Promise<AsyncActionResult<TData>>;
  cancel: () => void;
}

/** Single-flight form/action state with cancellation and late-result guards. */
export const useAsyncAction = (
  errorMessage: (error: unknown) => string
): AsyncActionState => {
  const loading = ref(false);
  const error = ref<string | null>(null);
  const lifecycle = createTenantLifecycle();

  const cancel = (): void => {
    lifecycle.invalidate();
    loading.value = false;
    error.value = null;
  };

  const run = async <TData>(
    action: (context: { readonly signal: AbortSignal }) => Promise<TData>
  ): Promise<AsyncActionResult<TData>> => {
    if (loading.value) return { status: 'busy' };

    lifecycle.invalidate();
    const ticket = lifecycle.capture();
    loading.value = true;
    error.value = null;

    try {
      const data = await action({ signal: ticket.signal });
      return ticket.isCurrent()
        ? { status: 'completed', data }
        : { status: 'cancelled' };
    } catch (cause) {
      if (!ticket.isCurrent()) return { status: 'cancelled' };
      const message = errorMessage(cause);
      error.value = message;
      return { status: 'failed', error: message };
    } finally {
      if (ticket.isCurrent()) loading.value = false;
    }
  };

  onScopeDispose(cancel);

  return { loading, error, run, cancel };
};
