// DataTable: the list, its states, search, sort, row click and selection. Cases ported from the Lit
// tests of OutfitKit's `ok-data-table` (issue numbers are ERPlora/outfitkit unless stated).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  byTestId,
  cards,
  click,
  dataRows,
  ionChange,
  mountTable,
  settle,
  text,
  type,
  viewport,
} from './__tests__/harness';

type Row = Record<string, unknown>;

beforeEach(() => {
  viewport(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
  document.documentElement.lang = '';
});

const PEOPLE: Row[] = [
  { id: 1, name: 'Ana' },
  { id: 2, name: 'Luis' },
];
const NAME = [{ key: 'name', label: 'Name' }];

describe('the list (CSS grid, not <table>)', () => {
  it('paints a table role with one header row and one row per record', async () => {
    const t = mountTable({ columns: [...NAME, { key: 'city', label: 'City' }], rows: [{ id: 1, name: 'Ana', city: 'Vigo' }] });
    await settle();
    expect(t.find('.data-table__grid').attributes('role')).toBe('table');
    const head = t.find('.data-table__row--head');
    expect(head.attributes('role')).toBe('row');
    expect(head.findAll('[role="columnheader"]').map((h) => h.text())).toEqual(['Name', 'City']);
    const [row] = dataRows(t);
    expect(row.getAttribute('role')).toBe('row');
    expect([...row.querySelectorAll('[role="cell"]')].map((c) => text(c))).toEqual(['Ana', 'Vigo']);
  });

  it('header and every row share the same track list (#121)', async () => {
    const t = mountTable({ columns: [...NAME, { key: 'n', label: 'N', width: '8rem' }], rows: PEOPLE, selectable: true });
    await settle();
    const head = (t.find('.data-table__row--head').element as HTMLElement).style.gridTemplateColumns;
    expect(head).toBe('2.75rem minmax(5.5rem,1fr) 8rem');
    for (const row of dataRows(t)) expect(row.style.gridTemplateColumns).toBe(head);
  });

  it('aligns cells and headers to the right or centre', async () => {
    const t = mountTable({ columns: [{ key: 'total', label: 'Total', align: 'right' }, { key: 'n', label: 'N', align: 'center' }], rows: [{ id: 1, total: 3, n: 1 }] });
    await settle();
    const [total, n] = t.findAll('.data-table__row--head .data-table__cell');
    expect(total.classes()).toContain('data-table__cell--right');
    expect(n.classes()).toContain('data-table__cell--center');
    expect(dataRows(t)[0].querySelector('.data-table__cell')?.classList.contains('data-table__cell--right')).toBe(true);
  });

  it('a column with `cell` is painted by that scoped slot (row, value, column)', async () => {
    const t = mountTable(
      { columns: [{ key: 'status', label: 'Status', cell: 'status' }], rows: [{ id: 1, status: 'open' }] },
      { slots: { status: `<template #status="{ row, value, column }"><b class="pill">{{ column.label }}:{{ value }}:{{ row.id }}</b></template>` } },
    );
    await settle();
    const cell = dataRows(t)[0].querySelector('[role="cell"]');
    expect(cell?.querySelector(':scope > b.pill')?.textContent).toBe('Status:open:1');
    expect(cell?.querySelector('[title]'), 'a slot cell gets no title').toBeNull();
  });

  it('a hidden column is not painted until picked in the column chooser', async () => {
    const t = mountTable({ columns: [...NAME, { key: 'cat', label: 'Category', hidden: true }], rows: [{ id: 1, name: 'Caja', cat: 'Sales' }] });
    await settle();
    expect(t.findAll('[role="columnheader"]').map((h) => h.text())).toEqual(['Name']);
    await ionChange(t.find('.data-table__columns-select').element, { value: ['name', 'cat'] });
    expect(t.findAll('[role="columnheader"]').map((h) => h.text())).toEqual(['Name', 'Category']);
    expect(t.emitted('columnsChange')).toEqual([[['name', 'cat']]]);
  });

  it('a hidden column still sorts the rows', async () => {
    const t = mountTable({
      columns: [{ key: 'name', label: 'App' }, { key: 'cat', label: 'Category', hidden: true }],
      rows: [{ id: 1, name: 'Caja', cat: 'Ventas' }, { id: 2, name: 'Agenda', cat: 'Clientes' }],
    });
    await settle();
    await ionChange(t.find('.data-table__columns-select').element, { value: ['name', 'cat'] });
    await click(t.findAll('[role="columnheader"]')[1].element);
    await ionChange(t.find('.data-table__columns-select').element, { value: ['name'] });
    expect(dataRows(t).map((r) => text(r))).toEqual(['Agenda', 'Caja']);
  });

  it('a column pinned to the end is fixed like the actions column', async () => {
    const t = mountTable({ columns: [...NAME, { key: 'tools', label: 'Tools', pinned: 'end' }], rows: PEOPLE });
    await settle();
    const pinned = t.findAll('.data-table__cell--pinned');
    expect(pinned).toHaveLength(3);
    expect(pinned[0].attributes('role')).toBe('columnheader');
    expect(pinned[1].attributes('role')).toBe('cell');
    const plain = mountTable({ columns: NAME, rows: PEOPLE });
    await settle();
    expect(plain.findAll('.data-table__cell--pinned')).toHaveLength(0);
  });
});

describe('a clipped cell can be read in full (#217)', () => {
  const LONG = 'Se consume en el local (servicio de restauración)';
  const ROWS = [
    { id: '1', name: 'Menú del día', mode: LONG, note: '' },
    { id: '2', name: 'Menú infantil', mode: 'Para llevar', note: null },
  ];
  const COLUMNS = [{ key: 'name', label: 'Nombre' }, { key: 'mode', label: 'Cómo se vende' }, { key: 'note', label: 'Nota' }];
  const span = (t: ReturnType<typeof mountTable>, key: string, col: number) =>
    t.element.querySelector(`[data-testid="combos-row"][data-id="${key}"]`)?.querySelectorAll('.data-table__cell')[col]?.querySelector(':scope > span') as HTMLElement;
  const clip = (el: HTMLElement, clipped: boolean) => {
    Object.defineProperty(el, 'scrollWidth', { configurable: true, get: () => (clipped ? 380 : 90) });
    Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => 90 });
  };
  async function tap(el: HTMLElement, pointerType: 'touch' | 'mouse') {
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType }));
    await click(el);
  }

  it('carries the full painted (formatted) text as the native title; an empty cell has none', async () => {
    const t = mountTable({ columns: [COLUMNS[0], { ...COLUMNS[1], format: (v: unknown) => `» ${String(v)}` }, COLUMNS[2]], rows: ROWS, testid: 'combos' });
    await settle();
    expect(span(t, '1', 1).getAttribute('title')).toBe(`» ${LONG}`);
    expect(span(t, '1', 1).textContent).toBe(`» ${LONG}`);
    expect(span(t, '1', 2).hasAttribute('title')).toBe(false);
    expect(span(t, '2', 2).hasAttribute('title')).toBe(false);
  });

  it('the header label carries its full text as title too', async () => {
    const t = mountTable({ columns: COLUMNS, rows: ROWS });
    await settle();
    const label = t.findAll('.data-table__row--head .data-table__cell')[1].find(':scope > span');
    expect(label.attributes('title')).toBe('Cómo se vende');
  });

  it('touch, rows that open nothing: a tap on a clipped cell unfolds only that cell', async () => {
    const t = mountTable({ columns: COLUMNS, rows: ROWS, testid: 'combos' });
    await settle();
    clip(span(t, '1', 1), true);
    await tap(span(t, '1', 1), 'touch');
    expect(span(t, '1', 1).classList.contains('data-table__text--unfolded')).toBe(true);
    expect(span(t, '1', 0).classList.contains('data-table__text--unfolded')).toBe(false);
    expect(span(t, '2', 1).classList.contains('data-table__text--unfolded')).toBe(false);
  });

  it('a cell that fits, a mouse click, or rows that open a record never unfold', async () => {
    const t = mountTable({ columns: COLUMNS, rows: ROWS, testid: 'combos' });
    await settle();
    clip(span(t, '2', 1), false);
    await tap(span(t, '2', 1), 'touch');
    clip(span(t, '1', 1), true);
    await tap(span(t, '1', 1), 'mouse');
    expect(t.findAll('.data-table__text--unfolded')).toHaveLength(0);

    const opening = mountTable({ columns: COLUMNS, rows: ROWS, testid: 'combos', rowClickable: true });
    await settle();
    clip(span(opening, '1', 1), true);
    await tap(span(opening, '1', 1), 'touch');
    expect(opening.findAll('.data-table__text--unfolded')).toHaveLength(0);
    expect(opening.emitted('rowClick')).toEqual([[ROWS[0]]]);
  });

  it('new rows start folded again', async () => {
    const t = mountTable({ columns: COLUMNS, rows: ROWS, testid: 'combos' });
    await settle();
    clip(span(t, '1', 1), true);
    await tap(span(t, '1', 1), 'touch');
    await t.setProps({ rows: [...ROWS] });
    await settle();
    expect(t.findAll('.data-table__text--unfolded')).toHaveLength(0);
  });
});

describe('«still loading» is not «empty» (#268)', () => {
  const base = { serverSide: true, rows: [], total: 0, columns: NAME, title: 'Customers', emptyMessage: 'No customers.' };
  const loading = (t: ReturnType<typeof mountTable>) => t.element.querySelector('[data-role="loading"]');
  const pager = (t: ReturnType<typeof mountTable>) => text(t.element.querySelector('.data-table__pager'));

  it('a first load does not count zero records nor claim the list is empty; announced and busy', async () => {
    const t = mountTable({ ...base, loading: true });
    await settle();
    expect(t.text()).not.toContain('No customers.');
    expect(t.find('.data-table__empty').exists()).toBe(false);
    expect(t.find('.data-table__title-count').exists()).toBe(false);
    expect(t.find('.data-table__pager').exists(), 'the page-size selector lives in the toolbar').toBe(false);
    expect(loading(t)?.getAttribute('role')).toBe('status');
    expect(text(loading(t))).toBe('Loading…');
    expect(loading(t)?.querySelector('ion-spinner')).not.toBeNull();
    expect(t.find('.data-table__surface').attributes('aria-busy')).toBe('true');
  });

  it('without a toolbar the footer keeps its page-size selector but no count, nor paging on an old total', async () => {
    const t = mountTable({ ...base, title: '', columnPicker: false, total: 50, loading: true });
    await settle();
    expect(t.find('.data-table__bar').exists()).toBe(false);
    expect(t.find('.data-table__pager select.data-table__pager-size').exists()).toBe(true);
    expect(pager(t)).not.toMatch(/records?|Showing/);
    expect(t.find('.data-table__pager-nav').exists()).toBe(false);
  });

  it('when the answer arrives it counts and shows it; an empty answer is «empty» and «0 records»', async () => {
    const t = mountTable({ ...base, loading: true });
    await settle();
    await t.setProps({ loading: false, rows: PEOPLE, total: 2 });
    await settle();
    expect(loading(t)).toBeNull();
    expect(t.find('.data-table__surface').attributes('aria-busy')).toBeUndefined();
    expect(t.find('.data-table__title-count').text()).toBe('2');
    expect(pager(t)).toMatch(/\b2 records\b/);
    const empty = mountTable({ ...base, loading: true });
    await settle();
    await empty.setProps({ loading: false });
    await settle();
    expect(empty.text()).toContain('No customers.');
    expect(pager(empty)).toMatch(/\b0 records\b/);
  });

  it('a reload with rows on screen keeps them and their count, busy', async () => {
    const t = mountTable({ ...base, rows: PEOPLE, total: 2, loading: true });
    await settle();
    expect(loading(t)).toBeNull();
    expect(t.text()).toContain('Ana');
    expect(t.find('.data-table__surface').attributes('aria-busy')).toBe('true');
  });

  it('a retry in flight shows the indicator, not the old error nor the rows left over', async () => {
    const t = mountTable({ ...base, rows: PEOPLE, total: 2, error: 'The hub is not responding.', loading: true });
    await settle();
    expect(t.find('[data-role="load-error"]').exists()).toBe(false);
    expect(t.text()).not.toContain('Ana');
    expect(loading(t)).not.toBeNull();
  });

  it('the card view and client mode show it too; Spanish; worded through `labels`; hooked by `testid`', async () => {
    const cardsView = mountTable({ ...base, views: ['table', 'cards'], defaultView: 'cards', loading: true });
    const client = mountTable({ ...base, serverSide: false, loading: true });
    const es = mountTable({ ...base, loading: true }, { locale: 'es' });
    const worded = mountTable({ ...base, loading: true, labels: { loading: 'Fetching customers…' }, testid: 'customers' });
    await settle();
    expect(text(loading(cardsView))).toBe('Loading…');
    expect(loading(client)).not.toBeNull();
    expect(text(loading(es))).toBe('Cargando…');
    expect(text(loading(worded))).toBe('Fetching customers…');
    expect(loading(worded)?.getAttribute('data-testid')).toBe('customers-loading');
  });

  it('on a phone: no count and no «Load more» while the first load is in flight', async () => {
    viewport(true);
    const t = mountTable({ ...base, total: 40, loading: true });
    await settle();
    expect(t.find('.data-table__load-more').exists()).toBe(false);
    expect(t.text()).not.toMatch(/\brecords\b/);
  });
});

describe('«could not load» is not «empty» (ERPlora/pm#530)', () => {
  const REASON = 'The hub is not responding. Try again in a moment.';
  const base = { serverSide: true, rows: [], total: 0, columns: NAME, title: 'Customers', emptyMessage: 'No customers.' };
  const errorBlock = (t: ReturnType<typeof mountTable>) => t.element.querySelector('[data-role="load-error"]');
  const retry = (t: ReturnType<typeof mountTable>) => t.element.querySelector('[data-role="load-error-retry"]');

  it('says so, gives the reason, is announced and does not count nor claim «empty»', async () => {
    const t = mountTable({ ...base, error: REASON });
    await settle();
    expect(t.text()).not.toContain('No customers.');
    expect(t.text()).not.toMatch(/\b0 records\b/);
    expect(t.find('.data-table__title-count').exists()).toBe(false);
    expect(errorBlock(t)?.getAttribute('role')).toBe('alert');
    expect(text(errorBlock(t))).toContain("Couldn't load the data");
    expect(text(errorBlock(t))).toContain(REASON);
    expect(text(retry(t))).toBe('Retry');
  });

  it('Retry emits `retry` once', async () => {
    const t = mountTable({ ...base, error: REASON });
    await settle();
    await click(retry(t));
    expect(t.emitted('retry')).toHaveLength(1);
  });

  it('rows left from an earlier load are not shown as current, in the list or the cards', async () => {
    const list = mountTable({ ...base, rows: PEOPLE, total: 2, error: REASON });
    const cardsView = mountTable({ ...base, rows: PEOPLE, total: 2, error: REASON, views: ['table', 'cards'], defaultView: 'cards' });
    await settle();
    expect(dataRows(list)).toHaveLength(0);
    expect(list.text()).not.toMatch(/\b2 records\b/);
    expect(cardsView.find('.data-table__cards').exists()).toBe(false);
    expect(retry(cardsView)).not.toBeNull();
  });

  it('on a phone: no pager at all while the load failed', async () => {
    viewport(true);
    const t = mountTable({ ...base, rows: PEOPLE, total: 40, error: REASON });
    await settle();
    expect(t.find('.data-table__pager').exists()).toBe(false);
  });

  it('clearing the error brings the normal states back; a blank reason is not an error', async () => {
    const t = mountTable({ ...base, error: REASON });
    await settle();
    await t.setProps({ error: '' });
    await settle();
    expect(errorBlock(t)).toBeNull();
    expect(t.text()).toContain('No customers.');
    const blank = mountTable({ ...base, error: '   ' });
    await settle();
    expect(errorBlock(blank)).toBeNull();
  });

  it('client mode too; Spanish; worded through `labels`; hooked by `testid`', async () => {
    const client = mountTable({ ...base, serverSide: false, rows: PEOPLE, error: REASON });
    const es = mountTable({ ...base, error: 'El hub no responde.' }, { locale: 'es' });
    const worded = mountTable({ ...base, error: REASON, labels: { loadError: 'Customers could not be loaded', retry: 'Try again' }, testid: 'customers' });
    await settle();
    expect(client.text()).not.toContain('Ana');
    expect(errorBlock(client)).not.toBeNull();
    expect(text(errorBlock(es))).toContain('No se han podido cargar los datos');
    expect(text(retry(es))).toBe('Reintentar');
    expect(text(errorBlock(worded))).toContain('Customers could not be loaded');
    expect(text(retry(worded))).toBe('Try again');
    expect(retry(worded)?.getAttribute('data-testid')).toBe('customers-retry');
  });
});

describe('«no matches» is not «empty» (#171)', () => {
  const ROWS = [{ id: 1, name: 'Restaurant' }, { id: 2, name: 'Hair salon' }];
  const base = { rows: ROWS, columns: NAME, searchKeys: ['name'], emptyMessage: 'No templates published yet' };
  const empty = (t: ReturnType<typeof mountTable>) => text(t.element.querySelector('.data-table__empty'));
  const reset = (t: ReturnType<typeof mountTable>) => t.element.querySelector('[data-role="no-matches-reset"]');

  it('a search that hides every row says so and offers «Show all»', async () => {
    const t = mountTable(base);
    await settle();
    await type(t, 'zzz');
    expect(dataRows(t)).toHaveLength(0);
    expect(empty(t)).toContain('No results match your search or filters');
    expect(empty(t)).not.toContain('No templates published yet');
    expect(text(reset(t))).toBe('Show all');
  });

  it('no rows at all is «empty», even with a search left in the box, and offers no reset', async () => {
    const t = mountTable({ ...base, rows: [] });
    await settle();
    await type(t, 'zzz');
    expect(empty(t)).toContain('No templates published yet');
    expect(reset(t)).toBeNull();
  });

  it('`noMatchesMessage`, `labels` and Spanish word it', async () => {
    const own = mountTable({ ...base, noMatchesMessage: 'No template matches' });
    const labelled = mountTable({ ...base, labels: { noMatches: 'Nope', showAll: 'Everything' } });
    const es = mountTable(base, { locale: 'es' });
    await settle();
    for (const t of [own, labelled, es]) await type(t, 'zzz');
    expect(empty(own)).toContain('No template matches');
    expect(empty(labelled)).toContain('Nope');
    expect(text(reset(labelled))).toBe('Everything');
    expect(empty(es)).toContain('Ningún resultado coincide con la búsqueda o los filtros');
    expect(text(reset(es))).toBe('Mostrar todo');
  });

  it('«Show all» clears the search: every row back, the box empty, the v-model told', async () => {
    const t = mountTable(base);
    await settle();
    await type(t, 'zzz');
    await click(reset(t));
    expect(t.find('.data-table__empty').exists()).toBe(false);
    expect(dataRows(t)).toHaveLength(2);
    expect((t.element.querySelector('ion-searchbar') as HTMLElement & { value?: string }).value).toBe('');
    expect(t.emitted('update:search')?.at(-1)).toEqual(['']);
  });

  it('server mode keeps its own empty message: the consumer owns the query', async () => {
    const t = mountTable({ ...base, serverSide: true, searchable: true, rows: [] });
    await settle();
    await type(t, 'zzz');
    expect(empty(t)).toContain('No templates published yet');
    expect(reset(t)).toBeNull();
  });

  it('the `empty` slot replaces the content of the empty state', async () => {
    const t = mountTable({ ...base, rows: [] }, { slots: { empty: '<p class="own-empty">Nothing yet</p>' } });
    await settle();
    expect(t.find('.data-table__empty .own-empty').text()).toBe('Nothing yet');
  });
});

describe('search (client filters in memory; server only tells)', () => {
  const ROWS = [{ id: 1, name: 'García' }, { id: 2, name: 'Pérez' }];
  const bar = (t: ReturnType<typeof mountTable>) => t.element.querySelector('ion-searchbar') as HTMLElement & { value?: string };

  it('appears with `searchable` or `searchKeys`; placeholder from the labels', async () => {
    const none = mountTable({ rows: ROWS, columns: NAME });
    const keys = mountTable({ rows: ROWS, columns: NAME, searchKeys: ['name'] }, { locale: 'es' });
    const own = mountTable({ rows: ROWS, columns: NAME, searchable: true, searchPlaceholder: 'Search users…' });
    await settle();
    expect(none.find('ion-searchbar').exists()).toBe(false);
    expect((keys.find('ion-searchbar').element as unknown as { placeholder?: string }).placeholder).toBe('Buscar…');
    expect((own.find('ion-searchbar').element as unknown as { placeholder?: string }).placeholder).toBe('Search users…');
  });

  it('client mode filters by the search keys and tells the v-model', async () => {
    const t = mountTable({ rows: ROWS, columns: NAME, searchKeys: ['name'] });
    await settle();
    await type(t, 'gar');
    expect(dataRows(t).map((r) => text(r))).toEqual(['García']);
    expect(t.emitted('update:search')).toEqual([['gar']]);
  });

  it('server mode emits what was typed and leaves the rows alone (#112)', async () => {
    const t = mountTable({ rows: ROWS, columns: NAME, serverSide: true, searchable: true, total: 2 });
    await settle();
    await type(t, 'Gar');
    expect(t.emitted('update:search')).toEqual([['Gar']]);
    expect(dataRows(t)).toHaveLength(2);
  });

  it('a `search` set from outside shows in the box, filters (client), and is not echoed back', async () => {
    const t = mountTable({ rows: ROWS, columns: NAME, searchKeys: ['name'] });
    await settle();
    await t.setProps({ search: 'García' });
    await settle();
    expect(bar(t).value).toBe('García');
    expect(dataRows(t).map((r) => text(r))).toEqual(['García']);
    expect(t.emitted('update:search')).toBeUndefined();
    const server = mountTable({ rows: ROWS, columns: NAME, serverSide: true, searchable: true, total: 1, search: 'García' });
    await settle();
    expect(bar(server).value).toBe('García');
  });

  it('server mode: clearing the search from outside empties the box too', async () => {
    const t = mountTable({ rows: ROWS, columns: NAME, serverSide: true, searchable: true, total: 2, search: 'García' });
    await settle();
    await t.setProps({ search: '' });
    await settle();
    expect(bar(t).value).toBe('');
  });

  it('`search` back to undefined releases control instead of blanking the box', async () => {
    const t = mountTable({ rows: ROWS, columns: NAME, searchKeys: ['name'], search: 'García' });
    await settle();
    await t.setProps({ search: undefined });
    await settle();
    expect(bar(t).value).toBe('García');
    expect(t.text()).toContain('García');
  });

  it('client mode: a search from outside starts at the first page of the new result set', async () => {
    const t = mountTable({ rows: ROWS, columns: NAME, searchKeys: ['name'], pageSize: 1 });
    await settle();
    await click(t.findAll('.data-table__page')[1].element);
    expect(t.text()).toContain('Pérez');
    await t.setProps({ search: 'García' });
    await settle();
    expect(dataRows(t).map((r) => text(r))).toEqual(['García']);
    await t.setProps({ search: '' });
    await settle();
    expect(dataRows(t).map((r) => text(r)), 'back to page 1, not to the old page 2').toEqual(['García']);
  });
});

describe('sorting', () => {
  const ROWS = [{ id: '1', name: 'Big', total: 100 }, { id: '2', name: 'Small', total: 9.5 }, { id: '3', name: 'Mid', total: 20 }];
  const COLUMNS = [{ key: 'name', label: 'Name' }, { key: 'total', label: 'Total', format: (v: unknown) => `${String(v)} €` }];
  const header = (t: ReturnType<typeof mountTable>, label: string) =>
    t.findAll('[role="columnheader"]').find((h) => h.text().includes(label))!.element;
  const caret = (t: ReturnType<typeof mountTable>, label: string) => header(t, label).querySelector('.data-table__caret');
  const icon = (t: ReturnType<typeof mountTable>, label: string) =>
    (caret(t, label)?.querySelector('ion-icon') as HTMLElement & { icon?: string } | undefined)?.icon ?? '';

  it('client mode: every column sorts by default (asc, then desc), the caret shows which and how', async () => {
    const t = mountTable({ rows: ROWS, columns: COLUMNS });
    await settle();
    expect(header(t, 'Total').classList.contains('data-table__cell--sortable')).toBe(true);
    expect(caret(t, 'Total')?.classList.contains('data-table__caret--active')).toBe(false);
    expect(icon(t, 'Total')).toContain('svg');
    const neutral = icon(t, 'Total');
    await click(header(t, 'Total'));
    expect(dataRows(t).map((r) => r.querySelector('[role="cell"]')?.textContent)).toEqual(['Small', 'Mid', 'Big']);
    expect(caret(t, 'Total')?.classList.contains('data-table__caret--active')).toBe(true);
    const asc = icon(t, 'Total');
    await click(header(t, 'Total'));
    expect(dataRows(t).map((r) => r.querySelector('[role="cell"]')?.textContent)).toEqual(['Big', 'Mid', 'Small']);
    expect(new Set([neutral, asc, icon(t, 'Total')]).size, 'three different carets').toBe(3);
    expect(t.emitted('sortChange'), 'client mode sorts by itself').toBeUndefined();
  });

  it('client mode: `sortable: false` opts a column out', async () => {
    const t = mountTable({ rows: ROWS, columns: [COLUMNS[0], { ...COLUMNS[1], sortable: false }] });
    await settle();
    expect(header(t, 'Total').classList.contains('data-table__cell--sortable')).toBe(false);
    expect(caret(t, 'Total')).toBeNull();
    await click(header(t, 'Total'));
    expect(dataRows(t).map((r) => r.querySelector('[role="cell"]')?.textContent)).toEqual(['Big', 'Small', 'Mid']);
  });

  it('server mode: asks with sortChange and keeps the rows as they came; only `sortable` columns', async () => {
    const t = mountTable({ rows: ROWS, columns: [COLUMNS[0], { ...COLUMNS[1], sortable: true }], serverSide: true, total: 3 });
    await settle();
    await click(header(t, 'Total'));
    await click(header(t, 'Name'));
    expect(t.emitted('sortChange')).toEqual([[{ sort: 'total', dir: 'asc' }]]);
    expect(dataRows(t).map((r) => r.querySelector('[role="cell"]')?.textContent)).toEqual(['Big', 'Small', 'Mid']);
  });

  it('server mode: the caret follows `sort`/`sortDir`, and asks the other direction on the active column', async () => {
    const t = mountTable({ rows: ROWS, columns: [COLUMNS[0], { ...COLUMNS[1], sortable: true }], serverSide: true, total: 3, sort: 'total', sortDir: 'asc' });
    await settle();
    expect(caret(t, 'Total')?.classList.contains('data-table__caret--active')).toBe(true);
    await click(header(t, 'Total'));
    expect(t.emitted('sortChange')).toEqual([[{ sort: 'total', dir: 'desc' }]]);
  });
});

describe('a row opens its record when the consumer asks for it (#67, #74)', () => {
  const ACTIONS = [{ id: 'open', label: 'Open' }];

  it('`rowClickable`: a click on the row emits rowClick with the record; it looks and acts as a control', async () => {
    const t = mountTable({ rows: PEOPLE, columns: NAME, rowClickable: true });
    await settle();
    await click(dataRows(t)[1]);
    expect(t.emitted('rowClick')).toEqual([[PEOPLE[1]]]);
    const row = dataRows(t)[0];
    expect(row.classList.contains('data-table__row--clickable')).toBe(true);
    expect(row.getAttribute('tabindex')).toBe('0');
  });

  it('Enter and Space activate it (and Space does not scroll the page)', async () => {
    const t = mountTable({ rows: PEOPLE, columns: NAME, rowClickable: true });
    await settle();
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    dataRows(t)[0].dispatchEvent(enter);
    dataRows(t)[0].dispatchEvent(space);
    dataRows(t)[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(t.emitted('rowClick')).toHaveLength(2);
    expect(space.defaultPrevented).toBe(true);
  });

  it('without it the row stays mute and out of the tab order', async () => {
    const t = mountTable({ rows: PEOPLE, columns: NAME });
    await settle();
    await click(dataRows(t)[0]);
    expect(t.emitted('rowClick')).toBeUndefined();
    expect(dataRows(t)[0].hasAttribute('tabindex')).toBe(false);
    expect(dataRows(t)[0].classList.contains('data-table__row--clickable')).toBe(false);
  });

  it('a row action or the selection checkbox does not also open the record', async () => {
    const t = mountTable({ rows: PEOPLE, columns: NAME, rowClickable: true, selectable: true, actions: ACTIONS });
    await settle();
    await click(dataRows(t)[0].querySelector('.data-table__actions ion-button'));
    await click(dataRows(t)[0].querySelector('.data-table__select-cell ion-checkbox'));
    expect(t.emitted('action')).toEqual([[{ actionId: 'open', row: PEOPLE[0] }]]);
    expect(t.emitted('rowClick')).toBeUndefined();
  });
});

describe('selection', () => {
  const checkbox = (row: Element) => row.querySelector('.data-table__select-cell ion-checkbox') as HTMLElement & { checked?: boolean };
  const headCheckbox = (t: ReturnType<typeof mountTable>) =>
    t.element.querySelector('.data-table__row--head ion-checkbox') as HTMLElement & { checked?: boolean };

  it('a checkbox column; picking a row selects it, marks it and shows the selection bar', async () => {
    const t = mountTable({ rows: PEOPLE, columns: NAME, selectable: true });
    await settle();
    expect(checkbox(dataRows(t)[0]).getAttribute('aria-label')).toBe('Select row');
    expect(headCheckbox(t).getAttribute('aria-label')).toBe('Select all');
    expect(t.find('.data-table__selection-bar').exists()).toBe(false);
    await ionChange(checkbox(dataRows(t)[1]));
    expect(t.emitted('update:selected')).toEqual([[['2']]]);
    expect(dataRows(t)[1].classList.contains('data-table__row--selected')).toBe(true);
    expect(checkbox(dataRows(t)[1]).checked).toBe(true);
    expect(t.find('.data-table__selection-bar strong').text()).toBe('1 selected');
  });

  it('select all, then none; «Clear» empties it', async () => {
    const t = mountTable({ rows: PEOPLE, columns: NAME, selectable: true });
    await settle();
    await ionChange(headCheckbox(t));
    expect(t.emitted('update:selected')?.at(-1)).toEqual([['1', '2']]);
    expect(headCheckbox(t).checked).toBe(true);
    await ionChange(headCheckbox(t));
    expect(t.emitted('update:selected')?.at(-1)).toEqual([[]]);
    await ionChange(headCheckbox(t));
    await click(t.find('.data-table__selection-clear').element);
    expect(t.emitted('update:selected')?.at(-1)).toEqual([[]]);
    expect(t.find('.data-table__selection-bar').exists()).toBe(false);
  });

  it('controlled with v-model:selected: the prop is the selection', async () => {
    const t = mountTable({ rows: PEOPLE, columns: NAME, selectable: true, selected: ['1'] }, { locale: 'es' });
    await settle();
    expect(dataRows(t)[0].classList.contains('data-table__row--selected')).toBe(true);
    expect(t.find('.data-table__selection-bar strong').text()).toBe('1 seleccionados');
    await ionChange(checkbox(dataRows(t)[1]));
    expect(t.emitted('update:selected')).toEqual([[['1', '2']]]);
    expect(dataRows(t)[1].classList.contains('data-table__row--selected'), 'the parent did not take it').toBe(false);
    await t.setProps({ selected: ['1', '2'] });
    await settle();
    expect(dataRows(t)[1].classList.contains('data-table__row--selected')).toBe(true);
  });

  it('the row key may be a function', async () => {
    const t = mountTable({ rows: PEOPLE, columns: NAME, selectable: true, rowKey: (r: Row) => `p-${String(r.id)}` });
    await settle();
    await ionChange(checkbox(dataRows(t)[0]));
    expect(t.emitted('update:selected')).toEqual([[['p-1']]]);
  });
});

describe('data-testid hooks of the chrome (#143)', () => {
  const ROWS = Array.from({ length: 12 }, (_, i) => ({ id: `r${i + 1}`, name: `Producto ${i + 1}` }));
  const props = { columns: NAME, rows: ROWS, actions: [{ id: 'edit', label: 'Editar', icon: 'create-outline' }], searchKeys: ['name'], addable: true };
  const hooks = (t: ReturnType<typeof mountTable>) => [...t.element.querySelectorAll('[data-testid]')].map((el) => el.getAttribute('data-testid'));
  /** A row (or card) hook: one `<prefix>-row` for every row, told apart by its key in `data-id`. */
  const row = (t: ReturnType<typeof mountTable>, key: string) =>
    [...t.element.querySelectorAll(`[data-testid="products-table-row"][data-id="${key}"]`)] as HTMLElement[];

  it('paints no hook without a prefix, nor for a blank one', async () => {
    const none = mountTable(props);
    const blank = mountTable({ ...props, testid: '   ' });
    await settle();
    expect(hooks(none)).toEqual([]);
    expect(hooks(blank)).toEqual([]);
    expect(none.element.querySelectorAll('[data-id]')).toHaveLength(0);
  });

  it('names add, primary action, search, rows, row actions and the pager — all from the prefix', async () => {
    const t = mountTable({ ...props, testid: 'products-table', primaryAction: { label: 'Import' } });
    await settle();
    expect(byTestId(t, 'products-table-add')[0].tagName).toBe('ION-BUTTON');
    expect(byTestId(t, 'products-table-primary-action')).toHaveLength(1);
    expect(byTestId(t, 'products-table-search')[0].tagName).toBe('ION-SEARCHBAR');
    expect(byTestId(t, 'products-table-row').map((el) => el.getAttribute('data-id'))).toEqual(ROWS.slice(0, 10).map((r) => r.id));
    expect(row(t, 'r1')[0].classList.contains('data-table__row--data')).toBe(true);
    expect(byTestId(t, 'products-table-row-r1-edit')).toHaveLength(1);
    expect(row(t, 'r11'), 'row 11 is on page 2').toHaveLength(0);
    expect(byTestId(t, 'products-table-page-prev')).toHaveLength(1);
    expect(byTestId(t, 'products-table-page-next')).toHaveLength(1);
    expect(hooks(t).filter((h) => !h?.startsWith('products-table-'))).toEqual([]);
  });

  it('each hook drives the control it names', async () => {
    const t = mountTable({ ...props, testid: 'products-table', primaryAction: { label: 'Import' } });
    await settle();
    await click(byTestId(t, 'products-table-page-next')[0]);
    expect(row(t, 'r11')).toHaveLength(1);
    expect(row(t, 'r1')).toHaveLength(0);
    await click(byTestId(t, 'products-table-page-prev')[0]);
    expect(row(t, 'r1')).toHaveLength(1);
    await click(byTestId(t, 'products-table-row-r1-edit')[0]);
    expect(t.emitted('action')).toEqual([[{ actionId: 'edit', row: ROWS[0] }]]);
    await click(byTestId(t, 'products-table-primary-action')[0]);
    expect(t.emitted('primaryAction')).toHaveLength(1);
    expect(t.emitted('add')).toBeUndefined();
    await click(byTestId(t, 'products-table-add')[0]);
    expect(t.emitted('add')).toHaveLength(1);
  });

  it('names the rows in the cards view, and «load more» on a phone', async () => {
    viewport(true);
    const t = mountTable({ ...props, testid: 'products-table', views: true });
    await settle();
    expect(cards(t)).toHaveLength(10);
    expect(row(t, 'r1')[0].tagName).toBe('ION-CARD');
    expect(byTestId(t, 'products-table-row')).toHaveLength(10);
    expect(byTestId(t, 'products-table-load-more')).toHaveLength(1);
    expect(byTestId(t, 'products-table-page-next')).toHaveLength(0);
  });
});

describe('language', () => {
  it('speaks the shell locale and follows it', async () => {
    const t = mountTable({ rows: [], columns: NAME, searchable: true }, { locale: 'es' });
    await settle();
    expect(t.text()).toContain('registros');
    expect(t.text()).not.toContain('records');
  });

  it('without vue-i18n it reads the document language, like the Lit original', async () => {
    document.documentElement.lang = 'es';
    const t = mountTable({ rows: [], columns: NAME }, { i18n: false });
    await settle();
    expect(t.text()).toContain('Sin resultados');
  });
});
