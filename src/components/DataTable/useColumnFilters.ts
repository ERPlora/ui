import { computed, ref, watch } from 'vue';

import { activeFilters, declaredFilters, filterColumnsOf, filterCount } from './model';
import type { DataTableColumn, DataTableFilterField, DataTableFilters } from './types';

const sameFilters = (a: DataTableFilters, b: DataTableFilters): boolean => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
};

/** The column filters in use: the table's own, or the parent's when it hands them over (`v-model:filters`),
 *  told back with `update:filters` and, in server mode, `filtersChange`. */
export function useColumnFilters<T extends object>(source: {
  columns: () => DataTableColumn<T>[];
  filterFields: () => DataTableFilterField[] | undefined;
  /** `undefined` = not controlled. */
  filters: () => DataTableFilters | undefined;
  serverSide: () => boolean;
  update: (filters: DataTableFilters) => void;
  /** Server mode: query again with these. */
  query: (filters: DataTableFilters) => void;
  /** Client mode: the filters changed, so the rows start again from the first one. */
  refiltered: () => void;
}) {
  /** The active filters on screen (own state; `filters` from the parent overrides it, like `search`). */
  const filterValues = ref<DataTableFilters>({});
  /** Every filter, as a column: the columns' own in column order, then `filterFields` (types.ts). */
  const filterColumns = computed(() => filterColumnsOf(source.columns(), source.filterFields()));
  /** The filtered columns (a range counts once): a name no column declares is no filter. */
  const filterCountNow = computed(() => filterCount(filterColumns.value, filterValues.value));
  const filtering = computed(() => filterCountNow.value > 0);

  function setFilters(next: DataTableFilters): void {
    const active = declaredFilters(filterColumns.value, next);
    if (sameFilters(active, filterValues.value)) return;
    filterValues.value = active;
    if (!source.serverSide()) source.refiltered();
    source.update(active);
    if (source.serverSide()) source.query(active);
  }
  /** One control of the filter row changed: applied at once. */
  function setFilter(name: string, value: string): void {
    setFilters({ ...filterValues.value, [name]: value });
  }
  function clearFilters(): void {
    setFilters({});
  }
  // `filters` from the parent is what the person is looking at; `undefined` = not controlled.
  watch(
    source.filters,
    (value) => {
      if (value === undefined) return;
      filterValues.value = activeFilters(value);
      if (!source.serverSide()) source.refiltered();
    },
    { immediate: true, deep: true },
  );

  return { filterValues, filterColumns, filterCountNow, filtering, setFilters, setFilter, clearFilters };
}
