// Pure logic of the DataTable, ported from `ok-data-table.ts` (OutfitKit) with the cases of its
// Lit tests that do not need a DOM.
import { describe, expect, it } from 'vitest';

import {
  cardTitleColumn,
  cellText,
  activeFilters,
  declaredFilters,
  entityWord,
  filterCount,
  filterKeys,
  filterRows,
  gridTemplate,
  inlineActions,
  pageList,
  pagerState,
  rowActionsFolded,
  rowKeyOf,
  sameRecords,
  searchRows,
  slotActions,
  sortKey,
  sortRows,
  toneStyle,
  visibleActions,
} from './model';
import type { DataTableAction, DataTableColumn } from './types';

type Row = Record<string, unknown>;
const col = (c: Partial<DataTableColumn<Row>> & { key: string }): DataTableColumn<Row> => ({ label: c.key, ...c });

const dmy = (iso: unknown): string => {
  if (typeof iso !== 'string' || !iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

describe('rowKeyOf', () => {
  it('reads a field or calls a function, always as text', () => {
    expect(rowKeyOf({ id: 7 }, 'id')).toBe('7');
    expect(rowKeyOf({ code: 'A' }, (r) => `k-${String(r.code)}`)).toBe('k-A');
    expect(rowKeyOf({ name: 'x' } as Row, 'id')).toBe('');
  });
});

describe('cellText', () => {
  it('formats with the value and the row; raw value otherwise; null/undefined paint nothing', () => {
    expect(cellText(col({ key: 'total', format: (v, r) => `${String(v)} ${String(r.cur)}` }), { total: 9, cur: '€' })).toBe('9 €');
    expect(cellText(col({ key: 'n' }), { n: 0 })).toBe('0');
    expect(cellText(col({ key: 'n' }), { n: null })).toBe('');
  });

  it('a format that returns something that is not text still paints (modules ship without typecheck)', () => {
    const odd = col({ key: 'p', format: (() => undefined) as unknown as () => string });
    expect(cellText(odd, { p: 1 })).toBe('');
    const numeric = col({ key: 'p', format: ((_v: unknown, r: Row) => r.p) as unknown as () => string });
    expect(cellText(numeric, { p: 7 })).toBe('7');
  });
});

describe('client sort follows the value, not the painted text (outfitkit#256)', () => {
  const SERIES: Row[] = [
    { id: 'a', name: 'Ana', start_date: '2027-01-15', end_date: '2027-01-15', max: null },
    { id: 'b', name: 'Bea', start_date: '2026-12-31', end_date: null, max: null },
    { id: 'c', name: 'Carla', start_date: '2027-03-31', end_date: '2026-12-31', max: null },
    { id: 'd', name: 'Dora', start_date: '2026-02-01', end_date: null, max: 4 },
    { id: 'e', name: 'Eva', start_date: '2026-11-02', end_date: '2027-03-31', max: 6 },
  ];
  const endsLabel = (_v: unknown, r: Row): string => {
    if (r.end_date && r.max) return `${dmy(r.end_date)} · Tras ${String(r.max)} citas`;
    if (r.end_date) return dmy(r.end_date);
    if (r.max) return `Tras ${String(r.max)} citas`;
    return 'Sin fin';
  };
  const names = (rows: Row[]) => rows.map((r) => r.name);

  it('a dd/mm/yyyy column sorts by the date, both ways', () => {
    const starts = col({ key: 'start_date', format: (v) => dmy(v) });
    expect(sortRows(SERIES, starts, 'asc').map((r) => dmy(r.start_date))).toEqual([
      '01/02/2026', '02/11/2026', '31/12/2026', '15/01/2027', '31/03/2027',
    ]);
    expect(names(sortRows(SERIES, starts, 'desc'))).toEqual(['Carla', 'Ana', 'Bea', 'Eva', 'Dora']);
  });

  it('a null field sorts last whichever the direction', () => {
    const ends = col({ key: 'end_date', format: endsLabel });
    expect(names(sortRows(SERIES, ends, 'asc'))).toEqual(['Carla', 'Ana', 'Eva', 'Bea', 'Dora']);
    const desc = names(sortRows(SERIES, ends, 'desc'));
    expect(desc.slice(0, 3)).toEqual(['Eva', 'Ana', 'Carla']);
    expect(desc.slice(3).sort()).toEqual(['Bea', 'Dora']);
  });

  it('money sorts by the amount, numbers and NUMERIC strings alike', () => {
    const eur = col({ key: 'total', format: (v) => `${String(v).replace('.', ',')} €` });
    const rows = [
      { name: 'Big', total: '100.00' },
      { name: 'Small', total: '9.50' },
      { name: 'Refund', total: '-3.25' },
      { name: 'Mid', total: 20 },
    ];
    expect(names(sortRows(rows, eur, 'asc'))).toEqual(['Refund', 'Small', 'Mid', 'Big']);
  });

  it('sortValue wins; without it a logical key or an object sorts by its text', () => {
    const rank: Record<string, number> = { a_high: 3, c_mid: 2, b_low: 1 };
    const priority = col({ key: 'status', format: (v) => String(v), sortValue: (r) => rank[r.status as string] });
    const rows = [{ name: 'Low', status: 'b_low' }, { name: 'High', status: 'a_high' }, { name: 'Mid', status: 'c_mid' }];
    expect(names(sortRows(rows, priority, 'asc'))).toEqual(['Low', 'Mid', 'High']);

    const full = col({ key: 'full', format: (_v, r) => `${String(r.first)} ${String(r.last)}` });
    expect(sortRows([{ first: 'Zoe', last: 'Alba' }, { first: 'Ana', last: 'Zamora' }], full, 'asc').map((r) => r.first)).toEqual(['Ana', 'Zoe']);

    const customer = col({ key: 'customer', format: (v) => (v as { name: string }).name });
    expect(sortKey(customer, { customer: { name: 'Marta' } })).toBe('Marta');
  });

  it('a Date sorts by the date; words stored behind a label sort by the label', () => {
    const when = col({ key: 'at', format: (v) => dmy((v as Date).toISOString()) });
    const at = new Date('2027-01-15T00:00:00Z');
    expect(sortKey(when, { at })).toBe(at);
    const label: Record<string, string> = { pending: 'Abierta', closed: 'Cerrada' };
    const status = col({ key: 'status', format: (v) => label[v as string] });
    expect(sortRows([{ status: 'pending' }, { status: 'closed' }], status, 'desc').map((r) => r.status)).toEqual(['closed', 'pending']);
  });

  it('never mutates the rows it is given', () => {
    const rows = [{ n: 2 }, { n: 1 }];
    sortRows(rows, col({ key: 'n' }), 'asc');
    expect(rows).toEqual([{ n: 2 }, { n: 1 }]);
  });
});

describe('searchRows', () => {
  const rows = [{ name: 'García' }, { name: 'Pérez' }, { name: null }];
  it('matches any search key, case-insensitive, trimmed; no needle or no keys keeps every row', () => {
    expect(searchRows(rows, ['name'], '  gar ')).toEqual([{ name: 'García' }]);
    expect(searchRows(rows, ['name'], '')).toBe(rows);
    expect(searchRows(rows, [], 'gar')).toBe(rows);
  });
});

describe('pageList: numbered pager with gaps', () => {
  it('lists every page up to 7, and first/last/neighbours with «…» beyond', () => {
    expect(pageList(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(pageList(1, 52)).toEqual([1, 2, 3, '…', 52]);
    expect(pageList(26, 52)).toEqual([1, '…', 25, 26, 27, '…', 52]);
    expect(pageList(52, 52)).toEqual([1, '…', 50, 51, 52]);
  });
});

describe('pagerState (hub#1984, #78, hub#2365)', () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String(i + 1) }));
  const base = { serverSide: false, total: 0, page: 0, pageSize: 10, isMobile: false, mobileShown: 0 };

  it('desktop client: the page window, with the last partial page clamped', () => {
    expect(pagerState({ ...base, rows: rows(14), page: 1 })).toMatchObject({ pages: 2, current: 1, count: 14, rangeFrom: 11, rangeTo: 14 });
    expect(pagerState({ ...base, rows: rows(25), page: 2 }).visible.map((r) => r.id)).toEqual(['21', '22', '23', '24', '25']);
    expect(pagerState({ ...base, rows: rows(25), page: 9 }).current).toBe(2);
  });

  it('desktop server: rows are the page, the range is clamped to the total', () => {
    const state = pagerState({ ...base, serverSide: true, rows: rows(4), total: 14, page: 1 });
    expect(state).toMatchObject({ pages: 2, current: 1, count: 14, rangeFrom: 11, rangeTo: 14 });
    expect(state.visible).toHaveLength(4);
  });

  it('phone client: accumulates from row 1 and offers more while rows are left', () => {
    const first = pagerState({ ...base, isMobile: true, rows: rows(25) });
    expect(first).toMatchObject({ rangeFrom: 1, rangeTo: 10, canLoadMore: true });
    expect(first.visible).toHaveLength(10);
    const all = pagerState({ ...base, isMobile: true, rows: rows(25), mobileShown: 25 });
    expect(all).toMatchObject({ rangeFrom: 1, rangeTo: 25, canLoadMore: false });
  });

  // The parent hands over a WINDOW that «Load more» grows (`loadMore`): `rows` start at the row of
  // `page` (0 on a phone) and the footer and «Load more» follow the rows shown against the total.
  it('phone server: the window the parent hands over, counted from its first row up to the rows shown', () => {
    const phone = { ...base, serverSide: true, isMobile: true, total: 25 };
    const first = pagerState({ ...phone, rows: rows(10), page: 0 });
    expect(first).toMatchObject({ rangeFrom: 1, rangeTo: 10, canLoadMore: true });
    expect(first.visible).toHaveLength(10);
    const grown = pagerState({ ...phone, rows: rows(20), page: 0 });
    expect(grown).toMatchObject({ rangeFrom: 1, rangeTo: 20, canLoadMore: true });
    expect(grown.visible).toHaveLength(20);
    expect(pagerState({ ...phone, rows: rows(15), page: 0 })).toMatchObject({ rangeFrom: 1, rangeTo: 15, canLoadMore: true });
    expect(pagerState({ ...phone, rows: rows(25), page: 0 })).toMatchObject({ rangeFrom: 1, rangeTo: 25, canLoadMore: false });
    // A window that does not start at the first row (a desk page not reset yet) keeps its offset.
    expect(pagerState({ ...phone, rows: rows(10), page: 1 })).toMatchObject({ rangeFrom: 11, rangeTo: 20, canLoadMore: true });
    expect(pagerState({ ...phone, rows: rows(5), page: 2 })).toMatchObject({ rangeFrom: 21, rangeTo: 25, canLoadMore: false });
    expect(pagerState({ ...phone, rows: [], page: 1 })).toMatchObject({ rangeFrom: 11, rangeTo: 20 });
    expect(pagerState({ ...phone, rows: [], total: 0 })).toMatchObject({ rangeTo: 0, canLoadMore: false });
  });
});

describe('gridTemplate (#120, #121)', () => {
  const cols = [col({ key: 'a' }), col({ key: 'b', width: '8rem' })];
  it('[checkbox] [columns, floor 5.5rem] [actions: max-content until measured, then px]', () => {
    expect(gridTemplate({ selectable: true, columns: cols, hasActions: true, actionsTrackPx: 0 })).toBe(
      '2.75rem minmax(5.5rem,1fr) 8rem max-content',
    );
    expect(gridTemplate({ selectable: false, columns: cols, hasActions: true, actionsTrackPx: 188 })).toBe(
      'minmax(5.5rem,1fr) 8rem 188px',
    );
    expect(gridTemplate({ selectable: false, columns: cols, hasActions: false, actionsTrackPx: 188 })).toBe('minmax(5.5rem,1fr) 8rem');
  });
});

describe('cardTitleColumn (outfitkit#205)', () => {
  const cols = [col({ key: 'code' }), col({ key: 'name' }), col({ key: 'currency' })];
  const row = { code: 'L1', name: 'Tarifa mayorista 1', currency: 'EUR' };
  it('is the first column whose text reads like the title (trimmed, numbers too)', () => {
    expect(cardTitleColumn('Tarifa mayorista 1', row, cols)?.key).toBe('name');
    expect(cardTitleColumn(' L1 ', row, cols)?.key).toBe('code');
    expect(cardTitleColumn(12, { n: 12 }, [col({ key: 'n' })])?.key).toBe('n');
  });
  it('none for an empty title, a non-text title, or a column painted by a slot', () => {
    expect(cardTitleColumn('', row, cols)).toBeUndefined();
    expect(cardTitleColumn(null, row, cols)).toBeUndefined();
    expect(cardTitleColumn('Tarifa mayorista 1', row, [col({ key: 'name', cell: 'name-cell' })])).toBeUndefined();
  });
});

describe('row actions (hub#2014, #213, #240)', () => {
  const rows: Row[] = [{ id: 'a', update: null }, { id: 'b', update: '2.0' }];
  const open: DataTableAction<Row> = { id: 'open', label: 'Open', icon: 'open-outline' };
  const update: DataTableAction<Row> = { id: 'update', label: 'Update', icon: 'cloud-download-outline', hidden: (r) => !r.update };
  const use: DataTableAction<Row> = { id: 'use', label: 'Use template' };

  it('visibleActions drops what is hidden for that row', () => {
    expect(visibleActions([open, update], rows[0]).map((a) => a.id)).toEqual(['open']);
    expect(visibleActions([open, update], rows[1]).map((a) => a.id)).toEqual(['open', 'update']);
  });

  it('slotActions keeps a column only for actions some row shows', () => {
    expect(slotActions([open, update], rows).map((a) => a.id)).toEqual(['open', 'update']);
    expect(slotActions([open, update], [rows[0]]).map((a) => a.id)).toEqual(['open']);
  });

  it('folds only when collapsed and there is more than one, or a single TEXT action', () => {
    expect(rowActionsFolded(false, [open, update])).toBe(false);
    expect(rowActionsFolded(true, [open, update])).toBe(true);
    expect(rowActionsFolded(true, [open])).toBe(false);
    expect(rowActionsFolded(true, [use])).toBe(true);
    expect(rowActionsFolded(true, [])).toBe(false);
    expect(rowActionsFolded(true, [{ ...open, showLabel: true }]), 'an icon with its label is wider than «⋮»').toBe(true);
  });
});

describe('inlineActions: the actions that keep a button at each fold of the row (W-19, §3b)', () => {
  const action = (id: string, extra: Partial<DataTableAction<Row>> = {}): DataTableAction<Row> => ({ id, label: id, icon: 'ellipse', ...extra });
  const open = action('open', { pinned: true });
  const manage = action('manage');
  const pay = action('pay');
  const transfer = action('transfer', { menuOnly: true });
  const ids = (actions: DataTableAction<Row>[]) => actions.map((a) => a.id);

  it('unfolded: every action but the `menuOnly` ones, however many (the box has room)', () => {
    expect(ids(inlineActions([open, manage, pay, transfer], 'none', 2))).toEqual(['open', 'manage', 'pay']);
    expect(ids(inlineActions([manage, pay, action('x'), action('y')], 'none', 1))).toEqual(['manage', 'pay', 'x', 'y']);
  });

  it('`extra`: the first `maxInline`, in their order; a pinned one counts first and never leaves', () => {
    expect(ids(inlineActions([manage, pay, action('x')], 'extra', 2))).toEqual(['manage', 'pay']);
    expect(ids(inlineActions([manage, pay, open], 'extra', 2)), 'pinned takes a place, kept in order').toEqual(['manage', 'open']);
    expect(ids(inlineActions([open, manage, pay, transfer], 'extra', 1))).toEqual(['open']);
    expect(ids(inlineActions([open, action('main', { pinned: true }), manage], 'extra', 1)), 'pinned ones beyond the limit stay').toEqual([
      'open',
      'main',
    ]);
    expect(ids(inlineActions([manage, pay], 'extra', 0))).toEqual([]);
  });

  it('`all`: only the pinned ones; `menuOnly` never, even pinned', () => {
    expect(ids(inlineActions([open, manage, pay, transfer], 'all', 2))).toEqual(['open']);
    expect(ids(inlineActions([action('odd', { pinned: true, menuOnly: true }), manage], 'all', 2))).toEqual([]);
    expect(ids(inlineActions([action('odd', { pinned: true, menuOnly: true })], 'none', 2))).toEqual([]);
  });
});

describe('entityWord: the noun of the footer count (§3b «4 negocios»)', () => {
  it('`{ one, many }` by the count; a function gets the count; nothing gives nothing', () => {
    expect(entityWord(1, { one: 'negocio', many: 'negocios' })).toBe('negocio');
    expect(entityWord(0, { one: 'negocio', many: 'negocios' })).toBe('negocios');
    expect(entityWord(4, { one: 'negocio', many: 'negocios' })).toBe('negocios');
    expect(entityWord(12, (n) => `factura${n === 1 ? '' : 's'}`)).toBe('facturas');
    expect(entityWord(3, undefined)).toBeUndefined();
  });
});

describe('toneStyle (#162)', () => {
  it('paints from the --ion-color token with Ionic’s default hex', () => {
    expect(toneStyle('danger', 'clear')).toBe('--color: var(--ion-color-danger, #c5000f);');
    expect(toneStyle('medium', 'text')).toBe('color: var(--ion-color-medium, #636469);');
    expect(toneStyle('brand', 'clear')).toBe('--color: var(--ion-color-brand);');
  });
  it('refuses an empty or unsafe tone (it goes into CSS)', () => {
    expect(toneStyle(undefined, 'clear')).toBeUndefined();
    expect(toneStyle('red;}', 'clear')).toBeUndefined();
  });
});

describe('sameRecords (hub#2245)', () => {
  const key = (r: Row) => String(r.id ?? '');
  it('same keys in the same order; keyless rows are never the same', () => {
    expect(sameRecords([{ id: 1 }, { id: 2 }], [{ id: 1, x: 1 }, { id: 2 }], key)).toBe(true);
    expect(sameRecords([{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 1 }], key)).toBe(false);
    expect(sameRecords([{ id: 1 }], [{ id: 1 }, { id: 2 }], key)).toBe(false);
    expect(sameRecords([{ n: 1 }], [{ n: 1 }], key)).toBe(false);
    expect(sameRecords(undefined, [{ id: 1 }], key)).toBe(false);
  });
});

// Column filters (hub-next apps/tax/UI-REQUESTS.md). The memory rule of ERPlora (ADR-0125): free
// text matches by «contains» («Ana» finds «Ana García»), a closed domain by equality (`active` must
// not match `inactive`).
describe('filterKeys: the names a column filter takes in `filters`', () => {
  it('its column key, its own key, or a range’s two ends', () => {
    expect(filterKeys(col({ key: 'name', filter: { type: 'text' } }))).toEqual(['name']);
    expect(filterKeys(col({ key: 'category', filter: { type: 'select', key: 'category_id', options: [] } }))).toEqual(['category_id']);
    expect(filterKeys(col({ key: 'rate', filter: { type: 'range' } }))).toEqual(['rate_from', 'rate_to']);
    expect(filterKeys(col({ key: 'name' }))).toEqual([]);
  });
});

describe('activeFilters: what actually filters', () => {
  it('drops empty and blank values', () => {
    expect(activeFilters({ name: '  ', status: '', rate_from: '5', city: 'Madrid' })).toEqual({ rate_from: '5', city: 'Madrid' });
  });
});

describe('declaredFilters: only what the page declared goes to the server (outfitkit#116)', () => {
  const COLUMNS = [
    col({ key: 'name', filter: { type: 'text' } }),
    col({ key: 'category', filter: { type: 'select', key: 'category_id', options: [] } }),
    col({ key: 'rate', filter: { type: 'range' } }),
    col({ key: 'note' }),
  ];

  it('keeps the declared names with a value, by the name the filter takes, and drops the rest', () => {
    expect(
      declaredFilters(COLUMNS, { name: 'ana', category: 'x', category_id: 'c1', rate_from: '5', rate_to: ' ', note: 'y', page: '2' }),
    ).toEqual({ name: 'ana', category_id: 'c1', rate_from: '5' });
  });

  it('nothing declared, nothing kept', () => {
    expect(declaredFilters([col({ key: 'name' })], { name: 'ana' })).toEqual({});
  });
});

describe('filterCount: the number on the funnel', () => {
  const COLUMNS = [
    col({ key: 'name', filter: { type: 'text' } }),
    col({ key: 'rate', filter: { type: 'range' } }),
    col({ key: 'day', filter: { type: 'date' } }),
  ];

  it('one per filtered column: a range with both ends counts once; blank and undeclared names do not count', () => {
    expect(filterCount(COLUMNS, {})).toBe(0);
    expect(filterCount(COLUMNS, { rate_from: '1', rate_to: '9' })).toBe(1);
    expect(filterCount(COLUMNS, { name: 'a', rate_to: '9', day: '2026-10-14' })).toBe(3);
    expect(filterCount(COLUMNS, { name: '  ', status: 'paid' })).toBe(0);
  });
});

describe('filterRows (client mode)', () => {
  const ROWS: Row[] = [
    { id: '1', name: 'Ana García', status: 'active', rate: 21, day: '2026-10-14T09:30:00Z', city_id: 'm' },
    { id: '2', name: 'Luis Ana', status: 'inactive', rate: 10, day: '2026-10-13', city_id: 'b' },
    { id: '3', name: 'Marta', status: 'active', rate: 4, day: null, city_id: 'm' },
    { id: '4', name: null, status: 'active', rate: null, day: new Date(2026, 9, 14, 23, 0), city_id: null },
  ];
  const ids = (rows: readonly Row[]) => rows.map((r) => r.id);
  const COLUMNS = [
    col({ key: 'name', filter: { type: 'text' } }),
    col({ key: 'status', filter: { type: 'select', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] } }),
    col({ key: 'rate', filter: { type: 'range' } }),
    col({ key: 'day', filter: { type: 'date' } }),
    col({ key: 'city', format: (_v, r) => (r.city_id === 'm' ? 'Madrid' : 'Barcelona'), filter: { type: 'select', key: 'city_id', options: [] } }),
    col({ key: 'label', format: (_v, r) => `#${String(r.id)} ${String(r.name ?? '')}`, filter: { type: 'text' } }),
  ];

  it('no active filter keeps every row, in order', () => {
    expect(ids(filterRows(ROWS, COLUMNS, {}))).toEqual(['1', '2', '3', '4']);
    expect(ids(filterRows(ROWS, COLUMNS, { name: ' ', status: '' }))).toEqual(['1', '2', '3', '4']);
  });

  it('free text: contains, case-insensitive, trimmed', () => {
    expect(ids(filterRows(ROWS, COLUMNS, { name: ' ana ' }))).toEqual(['1', '2']);
  });

  it('free text reads what the cell paints (its format)', () => {
    expect(ids(filterRows(ROWS, COLUMNS, { label: '#3' }))).toEqual(['3']);
  });

  it('a closed domain: exact equality (active does not match inactive)', () => {
    expect(ids(filterRows(ROWS, COLUMNS, { status: 'active' }))).toEqual(['1', '3', '4']);
    expect(ids(filterRows(ROWS, COLUMNS, { status: 'act' }))).toEqual([]);
  });

  it('a filter with its own key reads that field of the row (an id behind a painted name)', () => {
    expect(ids(filterRows(ROWS, COLUMNS, { city_id: 'm' }))).toEqual(['1', '3']);
  });

  it('a range: inclusive ends, either one alone; a row without a number is out', () => {
    expect(ids(filterRows(ROWS, COLUMNS, { rate_from: '10', rate_to: '21' }))).toEqual(['1', '2']);
    expect(ids(filterRows(ROWS, COLUMNS, { rate_from: '5' }))).toEqual(['1', '2']);
    expect(ids(filterRows(ROWS, COLUMNS, { rate_to: '4' }))).toEqual(['3']);
  });

  it('a day: the date part of an ISO value, or the local day of a Date', () => {
    expect(ids(filterRows(ROWS, COLUMNS, { day: '2026-10-14' }))).toEqual(['1', '4']);
    expect(ids(filterRows(ROWS, COLUMNS, { day: '2026-10-13' }))).toEqual(['2']);
  });

  it('every active filter must match (AND)', () => {
    expect(ids(filterRows(ROWS, COLUMNS, { status: 'active', rate_from: '5' }))).toEqual(['1']);
  });

  it('a value for a column without a filter filters nothing', () => {
    expect(ids(filterRows(ROWS, COLUMNS, { id: '2' }))).toEqual(['1', '2', '3', '4']);
  });
});
