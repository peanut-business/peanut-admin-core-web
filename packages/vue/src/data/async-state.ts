import {
  onScopeDispose,
  reactive,
  ref,
  shallowRef,
  type Ref,
  type ShallowRef,
} from "vue";

import { createTenantLifecycle } from "../lifecycle/tenant.js";

export interface AsyncListQuery<TFilters extends Record<string, unknown>> {
  readonly filters: Readonly<TFilters>;
  readonly page: number;
  readonly pageSize: number;
  readonly signal: AbortSignal;
}

export interface AsyncListPage<TItem> {
  readonly items: readonly TItem[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface AsyncListPagination {
  page: number;
  pageSize: number;
  total: number;
}

export interface AsyncListOptions<
  TItem,
  TFilters extends Record<string, unknown>
> {
  readonly initialFilters: TFilters;
  readonly initialPageSize: number;
  readonly load: (
    query: AsyncListQuery<TFilters>
  ) => Promise<AsyncListPage<TItem>>;
  readonly errorMessage: (error: unknown) => string;
}

export interface AsyncListState<
  TItem,
  TFilters extends Record<string, unknown>
> {
  readonly items: ShallowRef<readonly TItem[]>;
  readonly filters: Ref<TFilters>;
  readonly pagination: AsyncListPagination;
  readonly loading: Ref<boolean>;
  readonly error: Ref<string | null>;
  load: (page?: number) => Promise<boolean>;
  reload: () => Promise<boolean>;
  resetFilters: () => void;
  clear: () => void;
  dispose: () => void;
}

const positiveInteger = (value: number, fallback: number): number =>
  Number.isInteger(value) && value > 0 ? value : fallback;

const nonNegativeInteger = (value: number): number =>
  Number.isInteger(value) && value >= 0 ? value : 0;

/**
 * Request-scoped list state for ordinary Vue pages. Each load invalidates the
 * previous generation, so an aborted or late response cannot overwrite data
 * loaded for a newer filter, account, or Tenant context.
 */
export const useAsyncList = <TItem, TFilters extends Record<string, unknown>>(
  options: AsyncListOptions<TItem, TFilters>
): AsyncListState<TItem, TFilters> => {
  const initialFilters = { ...options.initialFilters };
  const initialPageSize = positiveInteger(options.initialPageSize, 20);
  const items = shallowRef<readonly TItem[]>([]);
  const filters = ref<TFilters>({ ...initialFilters }) as Ref<TFilters>;
  const pagination = reactive<AsyncListPagination>({
    page: 1,
    pageSize: initialPageSize,
    total: 0,
  });
  const loading = ref(false);
  const error = ref<string | null>(null);
  const lifecycle = createTenantLifecycle();

  const load = async (page = pagination.page): Promise<boolean> => {
    lifecycle.invalidate();
    const ticket = lifecycle.capture();
    loading.value = true;
    error.value = null;

    try {
      const result = await options.load({
        filters: { ...filters.value },
        page: positiveInteger(page, 1),
        pageSize: pagination.pageSize,
        signal: ticket.signal,
      });
      if (!ticket.isCurrent()) return false;

      items.value = [...result.items];
      pagination.page = positiveInteger(result.page, positiveInteger(page, 1));
      pagination.pageSize = positiveInteger(
        result.pageSize,
        pagination.pageSize
      );
      pagination.total = nonNegativeInteger(result.total);
      return true;
    } catch (cause) {
      if (!ticket.isCurrent()) return false;
      error.value = options.errorMessage(cause);
      return false;
    } finally {
      if (ticket.isCurrent()) loading.value = false;
    }
  };

  const clear = (): void => {
    lifecycle.invalidate();
    items.value = [];
    pagination.page = 1;
    pagination.total = 0;
    loading.value = false;
    error.value = null;
  };

  const dispose = (): void => {
    lifecycle.invalidate();
    loading.value = false;
  };

  onScopeDispose(dispose);

  return {
    items,
    filters,
    pagination,
    loading,
    error,
    load,
    reload: () => load(pagination.page),
    resetFilters: () => {
      filters.value = { ...initialFilters };
    },
    clear,
    dispose,
  };
};

export type AsyncActionResult<TData> =
  | { readonly status: "completed"; readonly data: TData }
  | { readonly status: "cancelled" }
  | { readonly status: "failed"; readonly error: string }
  | { readonly status: "busy" };

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
    if (loading.value) return { status: "busy" };

    lifecycle.invalidate();
    const ticket = lifecycle.capture();
    loading.value = true;
    error.value = null;

    try {
      const data = await action({ signal: ticket.signal });
      return ticket.isCurrent()
        ? { status: "completed", data }
        : { status: "cancelled" };
    } catch (cause) {
      if (!ticket.isCurrent()) return { status: "cancelled" };
      const message = errorMessage(cause);
      error.value = message;
      return { status: "failed", error: message };
    } finally {
      if (ticket.isCurrent()) loading.value = false;
    }
  };

  onScopeDispose(cancel);

  return { loading, error, run, cancel };
};
