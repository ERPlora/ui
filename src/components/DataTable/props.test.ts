import { afterEach, describe, expect, it } from 'vitest';

import Table from './DataTable.vue';
import { DATA_TABLE_DEFAULTS } from './props';
import { clearPage, mountTable, NAME, PEOPLE, type Table as Mounted } from './__tests__/harness';

/** The compiled component: what Vue reads to tell a prop or an event from an attribute. */
const DataTable = Table as unknown as { props: Record<string, unknown>; emits: string[] };
const UNSET = [
  'emptyMessage',
  'noMatchesMessage',
  'error',
  'searchPlaceholder',
  'search',
  'filters',
  'filterFields',
  'filterErrors',
  'maxWindow',
  'sort',
  'labels',
  'primaryAction',
  'defaultView',
  'selected',
  'cardTitle',
  'cardTitleColumn',
  'cardIcon',
  'entityLabel',
  'testid',
];
const propsOf = (t: Mounted) => t.props() as Record<string, unknown>;
const SWITCHES = ['loading', 'searchable', 'filterable', 'serverSide', 'addable', 'hideToolbarWhenEmpty', 'fill', 'rowClickable', 'selectable'];

describe('what the DataTable declares', () => {
  afterEach(clearPage);

  it('a page that only hands columns and rows gets these values', () => {
    const t = mountTable({ columns: NAME, rows: PEOPLE });
    expect(t.props()).toMatchObject({
      rowKey: 'id',
      pageSize: 10,
      pageSizeOptions: [10, 25, 50, 100],
      pageSizeChooser: true,
      searchKeys: [],
      total: 0,
      page: 0,
      sortDir: 'asc',
      actions: [],
      maxInlineActions: 2,
      columnPicker: true,
      title: '',
      views: false,
      cardBreakpoint: 640,
    });
    expect(UNSET.filter((name) => propsOf(t)[name] !== undefined)).toEqual([]);
  });

  it('every default it carries is one of its props', () => {
    expect(Object.keys(DATA_TABLE_DEFAULTS).filter((name) => !(name in DataTable.props))).toEqual([]);
  });

  it('its switches read like HTML attributes: written alone they are on, left out they are off', () => {
    const on = mountTable({ columns: NAME, rows: PEOPLE, ...Object.fromEntries(SWITCHES.map((name) => [name, ''])), views: '' });
    const off = mountTable({ columns: NAME, rows: PEOPLE });
    for (const name of [...SWITCHES, 'views']) expect([name, propsOf(on)[name]]).toEqual([name, true]);
    for (const name of SWITCHES) expect([name, propsOf(off)[name]]).toEqual([name, false]);
  });

  it('a listener of each of its events is an event of the table, never an attribute of its box', () => {
    expect(DataTable.emits).toEqual([
      'rowClick',
      'action',
      'sortChange',
      'pageChange',
      'loadMore',
      'toggle',
      'pageSizeChange',
      'update:search',
      'update:filters',
      'filtersChange',
      'update:selected',
      'columnsChange',
      'viewChange',
      'add',
      'primaryAction',
      'retry',
    ]);
  });
});
