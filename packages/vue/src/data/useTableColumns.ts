import { computed, ref, watch, type Ref } from 'vue';

export interface TableColumn { key: string; visible?: boolean; fixed?: 'left' | 'right' | false; width?: number }
export interface TableColumnOptions { storageKey?: string; version?: string | number; density?: string; fixedHeader?: boolean }
interface SavedColumns { version?: string | number; columns: TableColumn[]; density?: string; fixedHeader?: boolean }

export function useTableColumns<T extends TableColumn>(schema: readonly T[], options: TableColumnOptions = {}) {
  let saved: SavedColumns | undefined;
  try {
    if (options.storageKey && typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(options.storageKey);
      if (raw) { const parsed = JSON.parse(raw) as SavedColumns; if (parsed.version === options.version && Array.isArray(parsed.columns)) saved = parsed; }
    }
  } catch { /* storage is optional */ }
  const byKey = new Map(schema.map(column => [column.key, column]));
  const ordered = [...(saved?.columns ?? []).filter(c => byKey.has(c.key)), ...schema.filter(c => !saved?.columns.some(s => s.key === c.key))];
  const columns = ref(ordered.map(c => ({ ...byKey.get(c.key), ...c }))) as Ref<T[]>;
  const density = ref(saved?.density ?? options.density);
  const fixedHeader = ref(saved?.fixedHeader ?? options.fixedHeader);
  const visibleColumns = computed(() => columns.value.filter(c => c.visible !== false).slice().sort((a, b) => {
    const rank = (c: T) => c.fixed === 'left' ? 0 : c.fixed === 'right' ? 2 : 1;
    return rank(a) - rank(b);
  }));
  watch([columns, density, fixedHeader], () => {
    try {
      if (options.storageKey && typeof localStorage !== 'undefined') localStorage.setItem(options.storageKey, JSON.stringify({ version: options.version, columns: columns.value.map(({ key, visible, fixed, width }) => ({ key, visible, fixed, width })), density: density.value, fixedHeader: fixedHeader.value }));
    } catch { /* storage is optional */ }
  }, { deep: true });
  return { columns, visibleColumns, density, fixedHeader };
}
