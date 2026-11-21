import { ref } from 'vue';

import { DATA_TABLE_ICONS as ICONS, sortRows } from './model';
import type { DataTableColumn, DataTableSort, DataTableSortDir } from './types';

/** Sorting by the column headers: the table's own order in client mode, the parent's in server mode
 *  (`sort` and `sortDir` in, `sortChange` out). */
export function useColumnSort<T extends object>(source: {
  serverSide: () => boolean;
  sort: () => string | undefined;
  sortDir: () => DataTableSortDir;
  columns: () => DataTableColumn<T>[];
  emit: (sort: DataTableSort) => void;
  /** Client mode: a header click is about to put the rows in another order. */
  reordered: () => void;
}) {
  const clientSort = ref('');
  const clientSortDir = ref<DataTableSortDir>('asc');

  /** Server: opt-in (`sortable`). Client: every column unless `sortable: false`. */
  const isSortable = (column: DataTableColumn<T>): boolean => (source.serverSide() ? !!column.sortable : column.sortable !== false);
  const isSorted = (column: DataTableColumn<T>): boolean =>
    isSortable(column) && (source.serverSide() ? source.sort() === column.key : clientSort.value === column.key);
  const sortDirNow = (): DataTableSortDir => (source.serverSide() ? source.sortDir() : clientSortDir.value);
  function caretIcon(column: DataTableColumn<T>): string {
    if (!isSorted(column)) return ICONS.sortNone;
    return sortDirNow() === 'asc' ? ICONS.sortAsc : ICONS.sortDesc;
  }
  /** What the caret shows, said to assistive tech: only on the sorted column (ARIA). */
  function ariaSort(column: DataTableColumn<T>): 'ascending' | 'descending' | undefined {
    if (!isSorted(column)) return undefined;
    return sortDirNow() === 'asc' ? 'ascending' : 'descending';
  }
  function onHeaderClick(column: DataTableColumn<T>): void {
    if (!isSortable(column)) return;
    if (source.serverSide()) {
      source.emit({ sort: column.key, dir: source.sort() === column.key && source.sortDir() === 'asc' ? 'desc' : 'asc' });
      return;
    }
    source.reordered();
    if (clientSort.value === column.key) clientSortDir.value = clientSortDir.value === 'asc' ? 'desc' : 'asc';
    else {
      clientSort.value = column.key;
      clientSortDir.value = 'asc';
    }
  }
  /** Client mode: the rows in the order picked on the headers; as they came until one is clicked. */
  function sortedRows(rows: readonly T[]): readonly T[] {
    const column = clientSort.value ? source.columns().find((c) => c.key === clientSort.value) : undefined;
    return column ? sortRows(rows, column, clientSortDir.value) : rows;
  }

  return { isSortable, isSorted, caretIcon, ariaSort, onHeaderClick, sortedRows };
}

export type ColumnSort<T extends object> = ReturnType<typeof useColumnSort<T>>;
