// Compile-time contract of the DataTable's public types (checked by `vue-tsc`, run by `typecheck`).
// The runtime assertions only keep vitest from reporting an empty file.
import { describe, expect, expectTypeOf, it } from 'vitest';

import en from './locales/en.json';
import type {
  DataTableAction,
  DataTableActionEvent,
  DataTableColumn,
  DataTableColumnPriority,
  DataTableEntityLabel,
  DataTableFilterField,
  DataTableFilters,
  DataTableFilterType,
  DataTableLabelKey,
  DataTableLabels,
  DataTablePrimaryAction,
  DataTableRowKey,
  DataTableSort,
  DataTableView,
} from './types';

interface Item {
  id: string;
  name: string;
  total: number;
}

describe('DataTable types', () => {
  it('a column formats with the cell value AND its typed row', () => {
    const column: DataTableColumn<Item> = {
      key: 'total',
      label: 'Total',
      align: 'right',
      width: '8rem',
      sortable: true,
      format: (value, row) => `${String(value)} (${row.name})`,
      sortValue: (row) => row.total,
      cell: 'total-cell',
      hidden: false,
      pinned: 'end',
    };
    expectTypeOf(column.format).parameter(1).toEqualTypeOf<Item>();
    expect(column.key).toBe('total');
  });

  it('a row action label may be read from the row; disabled/loading/hidden are per row', () => {
    const action: DataTableAction<Item> = {
      id: 'refund',
      label: (row) => `Refund ${row.total}`,
      icon: 'arrow-undo-outline',
      color: 'danger',
      disabled: (row) => row.total === 0,
      loading: () => false,
      hidden: (row) => row.total < 0,
    };
    expectTypeOf<DataTableActionEvent<Item>>().toEqualTypeOf<{ actionId: string; row: Item }>();
    expect(action.id).toBe('refund');
  });

  it('the row key is a field of the row or a function of it', () => {
    expectTypeOf<'id'>().toMatchTypeOf<DataTableRowKey<Item>>();
    expectTypeOf<(row: Item) => string>().toMatchTypeOf<DataTableRowKey<Item>>();
    // @ts-expect-error -- not a field of Item
    const wrong: DataTableRowKey<Item> = 'missing';
    expect(wrong).toBe('missing');
  });

  it('views, sort and the primary action are the small closed shapes of the Lit original', () => {
    expectTypeOf<DataTableView>().toEqualTypeOf<'table' | 'cards'>();
    expectTypeOf<DataTableSort>().toEqualTypeOf<{ sort: string; dir: 'asc' | 'desc' }>();
    const primary: DataTablePrimaryAction = { label: 'New order', icon: 'add' };
    expect(primary.label).toBe('New order');
  });

  it('W-19: a column says how much it matters; an action may stay out or live only in «⋮»', () => {
    expectTypeOf<DataTableColumnPriority>().toEqualTypeOf<'high' | 'normal' | 'low'>();
    const column: DataTableColumn<Item> = { key: 'address', label: 'Web address', priority: 'low' };
    const open: DataTableAction<Item> = { id: 'open', label: 'Open', pinned: true };
    const transfer: DataTableAction<Item> = { id: 'transfer', label: 'Transfer ownership', menuOnly: true };
    // @ts-expect-error -- not a priority
    const wrong: DataTableColumn<Item> = { key: 'name', label: 'Name', priority: 'urgent' };
    expect([column.priority, open.pinned, transfer.menuOnly, wrong.key]).toEqual(['low', true, true, 'name']);
  });

  it('a column filter is text, a closed domain, a day, a range, a date range, a yes/no or a lookup; the filters are names to texts', () => {
    expectTypeOf<DataTableFilterType>().toEqualTypeOf<'text' | 'select' | 'date' | 'range' | 'daterange' | 'boolean' | 'lookup'>();
    const user: DataTableColumn<Item> = {
      key: 'user',
      label: 'User',
      filter: { type: 'lookup', key: 'user_id', load: async () => [{ value: '7', label: 'Ana' }], selected: { value: '7', label: 'Ana' } },
    };
    // @ts-expect-error -- a lookup asks the server: it needs `load`
    const blind: DataTableColumn<Item> = { key: 'user', label: 'User', filter: { type: 'lookup' } };
    const amount: DataTableColumn<Item> = { key: 'total', label: 'Total', filter: { type: 'range', amount: true, min: 0, max: 100, step: 0.01, keys: ['totalMin', 'totalMax'] } };
    expect([user.filter?.type, blind.key, amount.filter?.type]).toEqual(['lookup', 'user', 'range']);
    const status: DataTableColumn<Item> = {
      key: 'status',
      label: 'Status',
      filter: { type: 'select', key: 'status_id', options: [{ value: 'paid', label: 'Paid' }] },
    };
    // @ts-expect-error -- not a filter type
    const wrong: DataTableColumn<Item> = { key: 'name', label: 'Name', filter: { type: 'contains' } };
    expectTypeOf<DataTableFilters>().toEqualTypeOf<Record<string, string>>();
    expect([status.filter?.type, wrong.key]).toEqual(['select', 'name']);
  });

  it('a filter with no column of its own (`filterFields`) is a column filter with its name and its label', () => {
    const active: DataTableFilterField = { key: 'is_active', label: 'Active', type: 'boolean' };
    const user: DataTableFilterField = { key: 'user_id', label: 'User', type: 'lookup', load: async () => [] };
    // @ts-expect-error -- a field needs its label (the panel shows it)
    const nameless: DataTableFilterField = { key: 'is_active', type: 'boolean' };
    // @ts-expect-error -- and its name in `filters`
    const keyless: DataTableFilterField = { label: 'Active', type: 'boolean' };
    expect([active.type, user.type, nameless.key, keyless.label]).toEqual(['boolean', 'lookup', 'is_active', 'Active']);
  });

  it('the footer noun is `{ one, many }` or a function of the count', () => {
    expectTypeOf<{ one: string; many: string }>().toMatchTypeOf<DataTableEntityLabel>();
    expectTypeOf<(count: number) => string>().toMatchTypeOf<DataTableEntityLabel>();
    const label: DataTableEntityLabel = { one: 'negocio', many: 'negocios' };
    expect(label).toBeTruthy();
  });

  it('the labels are exactly the keys of the English catalogue', () => {
    expectTypeOf<DataTableLabelKey>().toEqualTypeOf<keyof typeof en.dataTable>();
    expectTypeOf<DataTableLabels[DataTableLabelKey]>().toEqualTypeOf<string>();
    expect(Object.keys(en.dataTable)).toContain('loadMore');
  });
});
