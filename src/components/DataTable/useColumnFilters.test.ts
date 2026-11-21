import { describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';

import type { DataTableColumn, DataTableFilterField, DataTableFilters } from './types';
import { useColumnFilters } from './useColumnFilters';

type Row = { id: string; name: string; status: string; rate: number };
const COLUMNS: DataTableColumn<Row>[] = [
  { key: 'name', label: 'Name', filter: { type: 'text' } },
  { key: 'status', label: 'Status', filter: { type: 'select', options: [{ value: 'open', label: 'Open' }] } },
  { key: 'rate', label: 'Rate', filter: { type: 'range' } },
  { key: 'note', label: 'Note' },
];
const ZONE: DataTableFilterField = { key: 'zone', label: 'Zone', type: 'text' };

function setup(options: { server?: boolean; filters?: DataTableFilters; fields?: DataTableFilterField[] } = {}) {
  const filters = ref(options.filters);
  const update = vi.fn();
  const query = vi.fn();
  const refiltered = vi.fn();
  const f = useColumnFilters<Row>({
    columns: () => COLUMNS,
    filterFields: () => options.fields,
    filters: () => filters.value,
    serverSide: () => options.server === true,
    update,
    query,
    refiltered,
  });
  return { ...f, filters, update, query, refiltered };
}
const keys = (columns: readonly DataTableColumn<Row>[]) => columns.map((column) => column.key);

describe('useColumnFilters', () => {
  it('every filter is a column: the columns’ own in order, then the fields; nothing filters at first', () => {
    const f = setup({ fields: [ZONE] });
    expect(keys(f.filterColumns.value)).toEqual(['name', 'status', 'rate', 'zone']);
    expect([f.filterValues.value, f.filterCountNow.value, f.filtering.value]).toEqual([{}, 0, false]);
  });

  it('client mode: a control applies at once, the rows start again and only `update:filters` is told', () => {
    const f = setup();
    f.setFilter('name', 'ana');
    expect(f.filterValues.value).toEqual({ name: 'ana' });
    expect(f.update).toHaveBeenCalledExactlyOnceWith({ name: 'ana' });
    expect(f.refiltered).toHaveBeenCalledOnce();
    expect(f.query).not.toHaveBeenCalled();
  });

  it('server mode: the active filters are asked for again and the rows are the parent’s to restart', () => {
    const f = setup({ server: true });
    f.setFilter('status', 'open');
    f.setFilter('rate_from', '5');
    expect(f.query.mock.calls).toEqual([[{ status: 'open' }], [{ status: 'open', rate_from: '5' }]]);
    expect(f.update.mock.calls).toEqual(f.query.mock.calls);
    expect(f.refiltered).not.toHaveBeenCalled();
  });

  it('counts the filtered columns, a range once, and says it is filtering', () => {
    const f = setup();
    f.setFilters({ rate_from: '5', rate_to: '9', status: 'open' });
    expect([f.filterCountNow.value, f.filtering.value]).toEqual([2, true]);
  });

  it('a blank value or a name no filter declares is no change: nothing is told and the rows stay', () => {
    const f = setup({ server: true });
    f.setFilter('name', '  ');
    f.setFilter('stale', 'x');
    expect(f.filterValues.value).toEqual({});
    expect([f.update, f.query, f.refiltered].map((spy) => spy.mock.calls.length)).toEqual([0, 0, 0]);
  });

  it('the same active filters again are no change, whatever their order', () => {
    const f = setup({ server: true });
    f.setFilters({ name: 'ana', status: 'open' });
    f.setFilters({ status: 'open', name: 'ana' });
    f.setFilters({ name: 'ana', status: 'open', rate_to: '' });
    expect(f.query).toHaveBeenCalledOnce();
  });

  it('one filter more or one less is a change', () => {
    const f = setup({ server: true });
    f.setFilters({ name: 'ana' });
    f.setFilters({ name: 'ana', status: 'open' });
    f.setFilters({ status: 'open' });
    expect(f.query).toHaveBeenCalledTimes(3);
  });

  it('a new value for a filter in use is a change', () => {
    const f = setup({ server: true });
    f.setFilter('name', 'ana');
    f.setFilter('name', 'luis');
    expect(f.query.mock.calls).toEqual([[{ name: 'ana' }], [{ name: 'luis' }]]);
    expect(f.filterValues.value).toEqual({ name: 'luis' });
  });

  it('a field’s name is declared too, and «Clear» lifts every filter at once', () => {
    const f = setup({ fields: [ZONE] });
    f.setFilters({ zone: 'north', name: 'ana' });
    expect(f.filterValues.value).toEqual({ zone: 'north', name: 'ana' });
    f.clearFilters();
    expect([f.filterValues.value, f.filtering.value]).toEqual([{}, false]);
    expect(f.update).toHaveBeenLastCalledWith({});
  });

  it('`v-model:filters`: the parent’s active filters are taken at once and on every change, without telling it back', async () => {
    const f = setup({ filters: { status: 'open', name: ' ' } });
    expect(f.filterValues.value).toEqual({ status: 'open' });
    expect(f.refiltered).toHaveBeenCalledOnce();
    f.filters.value = { name: 'ana' };
    await nextTick();
    expect(f.filterValues.value).toEqual({ name: 'ana' });
    expect(f.refiltered).toHaveBeenCalledTimes(2);
    expect([f.update, f.query].map((spy) => spy.mock.calls.length)).toEqual([0, 0]);
  });

  it('`v-model:filters`: a value changed inside the parent’s object counts too', async () => {
    const f = setup({ filters: { name: 'ana' } });
    f.filters.value!.name = 'luis';
    await nextTick();
    expect(f.filterValues.value).toEqual({ name: 'luis' });
  });

  it('server mode: a change from the parent does not restart the rows, which are the parent’s', async () => {
    const f = setup({ server: true, filters: { name: 'ana' } });
    f.filters.value = { status: 'open' };
    await nextTick();
    expect(f.filterValues.value).toEqual({ status: 'open' });
    expect(f.refiltered).not.toHaveBeenCalled();
  });

  it('not controlled (`undefined`): the filters on screen are its own and stay', async () => {
    const f = setup({ filters: { name: 'ana' } });
    f.filters.value = undefined;
    await nextTick();
    expect(f.filterValues.value).toEqual({ name: 'ana' });
    expect(f.refiltered).toHaveBeenCalledOnce();
  });
});
