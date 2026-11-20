import { computed, getCurrentInstance, onActivated, onDeactivated, onScopeDispose, ref, shallowRef, watch, type Ref } from 'vue';
import { useAsyncList, type AsyncListOptions, type AsyncListQuery, type AsyncListPage } from './useAsyncList.js';
import { useAsyncAction } from './useAsyncAction.js';

export interface CrudScope { active: Readonly<Ref<boolean>> }
export interface CrudSort { prop: string; order: 'ascending' | 'descending' | null }
export interface CrudTableOptions<T, F extends Record<string, unknown>> extends Omit<AsyncListOptions<T, F>, 'load'> {
  load: (query: AsyncListQuery<F> & { readonly sort?: CrudSort }) => Promise<AsyncListPage<T>>;
  deleteRecord?: (record: T, signal: AbortSignal) => Promise<unknown>;
  deleteErrorMessage?: (error: unknown) => string;
  scope?: CrudScope;
}
export function useCrudTable<T, F extends Record<string, unknown>>(options: CrudTableOptions<T, F>) {
  const sort = shallowRef<CrudSort>();
  const list = useAsyncList({ ...options, load: query => options.load({ ...query, ...(sort.value ? { sort: sort.value } : {}) }) });
  const deletion = useAsyncAction(options.deleteErrorMessage ?? options.errorMessage);
  const active = ref(true);
  if (getCurrentInstance()) { onActivated(() => { active.value = true; }); onDeactivated(() => { active.value = false; }); }
  const current = computed(() => active.value && (options.scope?.active.value ?? true));
  const selection = shallowRef<readonly T[]>([]);
  let requestedPage = list.pagination.page;
  let resumePage: number | undefined;
  const inactive = () => {
    if (list.loading.value || deletion.loading.value) resumePage = requestedPage;
    list.dispose(); deletion.cancel();
  };
  watch(current, active => {
    if (!active) inactive();
    else if (resumePage !== undefined) { const page = resumePage; resumePage = undefined; void list.load(page); }
  }, { flush: 'sync' });
  onScopeDispose(inactive);
  const fetchList = async (page = list.pagination.page) => {
    if (!current.value) return false;
    requestedPage = page;
    return list.load(page);
  };
  const handleSearch = () => fetchList(1);
  const handleReset = () => { list.resetFilters(); return handleSearch(); };
  const handleDelete = async (record: T) => {
    const remove = options.deleteRecord;
    if (!current.value || !remove) return false;
    const result = await deletion.run(async ({ signal }) => {
      await remove(record, signal);
      if (!signal.aborted) await fetchList(requestedPage);
    });
    return result.status === 'completed' && current.value;
  };
  return { loading: list.loading, pagination: list.pagination, searchForm: list.filters, data: list.items,
    error: list.error, clear: () => { list.clear(); selection.value = []; }, deleting: deletion.loading, deleteError: deletion.error,
    fetchList, handleSearch, handleReset, handleDelete, selection, sort,
    setSelection: (value: readonly T[]) => { selection.value = value; },
    setSort: (value: CrudSort | undefined) => { sort.value = value; },
    handleSelectionChange: (value: readonly T[]) => { selection.value = value; },
    handleSortChange: (value: CrudSort | undefined) => { sort.value = value; return fetchList(1); } };
}
