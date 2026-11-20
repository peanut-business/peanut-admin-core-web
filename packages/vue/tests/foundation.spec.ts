import { effectScope, nextTick, ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { useCrudTable, useDict, useTableColumns } from '../src/index';

describe('shared data primitives', () => {
  it('shares dictionary loading per namespace and prevents invalidated completion', async () => {
    let resolve!: (value: string) => void;
    const load = vi.fn(() => new Promise<string>(done => { resolve = done; }));
    const scope = effectScope();
    const [a, b] = scope.run(() => [useDict({ namespace: 'tenant-a', key: 'status', load }), useDict({ namespace: 'tenant-a', key: 'status', load })])!;
    const one = a.load(); const two = b.load(); await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(1);
    a.invalidate(); resolve('old');
    expect(await one).toBe(false); expect(await two).toBe(false); expect(b.data.value).toBeUndefined();
    scope.stop();
  });
  it('caches by tenant and clears immediately on tenant change', async () => {
    const namespace = ref('cache-a'); const load = vi.fn(async () => 'value');
    const scope = effectScope(); const state = scope.run(() => useDict({ namespace, key: 'key', load }))!;
    expect(await state.load()).toBe(true); expect(await state.load()).toBe(true); expect(load).toHaveBeenCalledTimes(1);
    namespace.value = 'cache-b'; expect(state.data.value).toBeUndefined();
    await state.load(); expect(load).toHaveBeenCalledTimes(2); scope.stop();
  });
  it('passes sorting through to the list loader', async () => {
    const load = vi.fn(async (query: { page: number; pageSize: number }) => ({ items: [], total: 0, page: query.page, pageSize: query.pageSize }));
    const scope = effectScope(); const table = scope.run(() => useCrudTable({ initialFilters: {}, initialPageSize: 20, load, errorMessage: String }))!;
    await table.handleSortChange({ prop: 'name', order: 'ascending' });
    expect(load).toHaveBeenCalledWith(expect.objectContaining({ sort: { prop: 'name', order: 'ascending' }, page: 1 })); scope.stop();
  });
  it('keeps schema order within fixed partitions', async () => {
    const scope = effectScope();
    const state = scope.run(() => useTableColumns([{ key: 'a' }, { key: 'b', fixed: 'left' as const }, { key: 'c', fixed: 'right' as const }]));
    expect(state!.visibleColumns.value.map(c => c.key)).toEqual(['b', 'a', 'c']);
    state!.columns.value[0]!.visible = false; await nextTick();
    expect(state!.visibleColumns.value.map(c => c.key)).toEqual(['b', 'c']);
    scope.stop();
  });
});
