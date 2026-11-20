import { computed, ref, watch, type Ref } from 'vue';

export interface TableColumn {
  key: string;
  visible?: boolean;
  fixed?: 'left' | 'right' | false;
  width?: number;
}
export interface TableColumnOptions {
  storageKey?: string;
  version?: string | number;
  density?: string;
  fixedHeader?: boolean;
}

export function useTableColumns<T extends TableColumn>(schema: readonly T[], options: TableColumnOptions = {}) {
  let savedColumns: TableColumn[] = [];
  let savedDensity: string | undefined;
  let savedFixedHeader: boolean | undefined;
  try {
    if (options.storageKey && typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(options.storageKey);
      const parsed: unknown = raw ? JSON.parse(raw) : undefined;
      if (parsed && typeof parsed === 'object' && (!('version' in parsed) ? undefined : parsed.version) === options.version && 'columns' in parsed && Array.isArray(parsed.columns)) {
        const seen = new Set<string>();
        for (const item of parsed.columns) {
          if (!item || typeof item !== 'object' || typeof item.key !== 'string' || seen.has(item.key)) continue;
          seen.add(item.key);
          const entry: TableColumn = { key: item.key };
          if (typeof item.visible === 'boolean') entry.visible = item.visible;
          if (item.fixed === false || item.fixed === 'left' || item.fixed === 'right') entry.fixed = item.fixed;
          if (typeof item.width === 'number' && Number.isFinite(item.width) && item.width > 0) entry.width = item.width;
          savedColumns.push(entry);
        }
        if ('density' in parsed && typeof parsed.density === 'string') savedDensity = parsed.density;
        if ('fixedHeader' in parsed && typeof parsed.fixedHeader === 'boolean') savedFixedHeader = parsed.fixedHeader;
      }
    }
  } catch { /* storage is optional */ }
  const byKey = new Map(schema.map(column => [column.key, column]));
  const ordered = [
    ...savedColumns.filter(column => byKey.has(column.key)),
    ...schema.filter(column => !savedColumns.some(saved => saved.key === column.key)),
  ];
  const columns = ref(ordered.map(column => ({ ...byKey.get(column.key), ...column }))) as Ref<T[]>;
  const density = ref(savedDensity ?? options.density);
  const fixedHeader = ref(savedFixedHeader ?? options.fixedHeader);
  const visibleColumns = computed(() => columns.value.filter(column => column.visible !== false).slice().sort((a, b) => {
    const rank = (column: T) => column.fixed === 'left' ? 0 : column.fixed === 'right' ? 2 : 1;
    return rank(a) - rank(b);
  }));
  const reset = () => {
    columns.value = schema.map(column => ({ ...column }));
    density.value = options.density;
    fixedHeader.value = options.fixedHeader;
  };
  watch([columns, density, fixedHeader], () => {
    try {
      if (options.storageKey && typeof localStorage !== 'undefined') {
        localStorage.setItem(options.storageKey, JSON.stringify({
          version: options.version,
          columns: columns.value.map(({ key, visible, fixed, width }) => ({ key, visible, fixed, width })),
          density: density.value,
          fixedHeader: fixedHeader.value,
        }));
      }
    } catch { /* storage is optional */ }
  }, { deep: true });
  return { columns, visibleColumns, density, fixedHeader, reset };
}
