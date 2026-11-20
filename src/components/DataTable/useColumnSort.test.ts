import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import { DATA_TABLE_ICONS } from './model';
import type { DataTableColumn, DataTableSortDir } from './types';
import { useColumnSort } from './useColumnSort';

type Row = { id: string; name: string; total: number };
const rows: Row[] = [
  { id: '1', name: 'Big', total: 100 },
  { id: '2', name: 'Small', total: 9.5 },
  { id: '3', name: 'Mid', total: 20 },
];
const name: DataTableColumn<Row> = { key: 'name', label: 'Name' };
const total: DataTableColumn<Row> = { key: 'total', label: 'Total' };

function setup(server: { sort?: string; sortDir?: DataTableSortDir } | null, columns = [name, total]) {
  const sort = ref(server?.sort);
  const sortDir = ref<DataTableSortDir>(server?.sortDir ?? 'asc');
  const emit = vi.fn();
  const reordered = vi.fn();
  const s = useColumnSort<Row>({
    serverSide: () => server !== null,
    sort: () => sort.value,
    sortDir: () => sortDir.value,
    columns: () => columns,
    emit,
    reordered,
  });
  return { ...s, emit, reordered };
}
const names = (list: readonly Row[]) => list.map((row) => row.name);

describe('useColumnSort', () => {
  it('client mode: a header sorts ascending, then descending, and the caret and aria-sort say so', () => {
    const s = setup(null);
    expect([s.isSorted(total), s.caretIcon(total), s.ariaSort(total)]).toEqual([false, DATA_TABLE_ICONS.sortNone, undefined]);
    s.onHeaderClick(total);
    expect([s.isSorted(total), s.caretIcon(total), s.ariaSort(total)]).toEqual([true, DATA_TABLE_ICONS.sortAsc, 'ascending']);
    expect(names(s.sortedRows(rows))).toEqual(['Small', 'Mid', 'Big']);
    s.onHeaderClick(total);
    expect([s.caretIcon(total), s.ariaSort(total)]).toEqual([DATA_TABLE_ICONS.sortDesc, 'descending']);
    expect(names(s.sortedRows(rows))).toEqual(['Big', 'Mid', 'Small']);
    expect(s.reordered).toHaveBeenCalledTimes(2);
    expect(s.emit).not.toHaveBeenCalled();
  });

  it('client mode: the rows keep their order until a header is clicked, and `sortable: false` opts a column out', () => {
    const s = setup(null, [name, { ...total, sortable: false }]);
    expect(s.sortedRows(rows)).toBe(rows);
    expect(s.isSortable({ ...total, sortable: false })).toBe(false);
    s.onHeaderClick({ ...total, sortable: false });
    expect(s.sortedRows(rows)).toBe(rows);
    expect(s.reordered).not.toHaveBeenCalled();
  });

  it('server mode: only `sortable` columns ask with the event; the rows are never reordered here', () => {
    const s = setup({});
    s.onHeaderClick(name);
    s.onHeaderClick({ ...total, sortable: true });
    expect(s.emit.mock.calls).toEqual([[{ sort: 'total', dir: 'asc' }]]);
    expect(s.sortedRows(rows)).toBe(rows);
    expect(s.reordered).not.toHaveBeenCalled();
  });

  it('server mode: the caret follows `sort` and `sortDir`, and the active column asks the other direction', () => {
    const sortable = { ...total, sortable: true };
    const s = setup({ sort: 'total', sortDir: 'asc' });
    expect([s.isSorted(sortable), s.ariaSort(sortable)]).toEqual([true, 'ascending']);
    s.onHeaderClick(sortable);
    expect(s.emit.mock.calls).toEqual([[{ sort: 'total', dir: 'desc' }]]);
  });
});
