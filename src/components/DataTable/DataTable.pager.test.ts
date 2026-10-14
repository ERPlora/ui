// DataTable footer: the range it reports (hub#1984, hub#2365), the numbered pager on a desk, «Load
// more» on a phone (#78, hub#2245) and the page size. Cases ported from the Lit tests.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { byTestId, click, crossBreakpoint, dataRows, ionChange, mountTable, settle, text, type, viewport } from './__tests__/harness';

beforeEach(() => {
  viewport(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

const NAME = [{ key: 'name', label: 'Name' }];
const rowsOf = (n: number, offset = 0) => Array.from({ length: n }, (_, i) => ({ id: String(offset + i + 1), name: `Servicio ${offset + i + 1}` }));
const info = (t: ReturnType<typeof mountTable>) => text(t.element.querySelector('.data-table__pager-info'));
const page = (t: ReturnType<typeof mountTable>, n: number) =>
  [...t.element.querySelectorAll('.data-table__pager-nav .data-table__page')].find((b) => text(b) === String(n)) as HTMLElement;
const loadMore = (t: ReturnType<typeof mountTable>) => t.element.querySelector('.data-table__pager .data-table__load-more') as HTMLElement | null;

describe('desk: the numbered pager', () => {
  it('pages ten by ten, never accumulates, and reports the window of each page', async () => {
    const t = mountTable({ rows: rowsOf(25), columns: NAME, pageSize: 10 });
    await settle();
    expect(dataRows(t)).toHaveLength(10);
    expect(info(t)).toBe('Showing 1–10 of 25 records');
    expect(loadMore(t)).toBeNull();
    await click(page(t, 2));
    expect(dataRows(t)).toHaveLength(10);
    expect(text(dataRows(t)[0])).toBe('Servicio 11');
    expect(info(t)).toContain('11–20 of');
    await click(page(t, 3));
    expect(info(t)).toContain('21–25 of');
    expect(page(t, 3).classList.contains('data-table__page--current')).toBe(true);
  });

  it('the last partial page says 11–14, never 11–10 (hub#1984)', async () => {
    const t = mountTable({ rows: rowsOf(14), columns: NAME, pageSize: 10 });
    await settle();
    await click(page(t, 2));
    expect(info(t)).toContain('11–14 of');
  });

  it('prev/next are disabled at the bounds and move one page', async () => {
    const t = mountTable({ rows: rowsOf(25), columns: NAME, testid: 'svc' });
    await settle();
    const prev = byTestId(t, 'svc-page-prev')[0] as HTMLElement & { disabled?: boolean };
    expect(prev.disabled).toBe(true);
    await click(byTestId(t, 'svc-page-next')[0]);
    await click(byTestId(t, 'svc-page-next')[0]);
    expect((byTestId(t, 'svc-page-next')[0] as HTMLElement & { disabled?: boolean }).disabled).toBe(true);
    expect(info(t)).toContain('21–25 of');
    await click(byTestId(t, 'svc-page-prev')[0]);
    expect(info(t)).toContain('11–20 of');
  });

  it('long lists show first, last and neighbours with «…» in the jumps', async () => {
    const t = mountTable({ rows: rowsOf(520), columns: NAME });
    await settle();
    const labels = () => [...t.element.querySelectorAll('.data-table__pager-nav .data-table__page, .data-table__pager-nav .data-table__page-gap')].map((e) => text(e));
    expect(labels()).toEqual(['1', '2', '3', '…', '52']);
    await click(page(t, 3));
    await click(page(t, 4));
    expect(labels()).toEqual(['1', '…', '3', '4', '5', '…', '52']);
  });

  it('server mode asks the parent for the page and reports it clamped to the total', async () => {
    const t = mountTable({ serverSide: true, rows: rowsOf(4, 10), total: 14, page: 1, columns: NAME });
    await settle();
    expect(info(t)).toContain('11–14 of');
    await click(page(t, 1));
    expect(t.emitted('pageChange')).toEqual([[0]]);
    expect(dataRows(t), 'the rows are the parent’s to change').toHaveLength(4);
  });

  it('one record says «record», and a single page shows only the count', async () => {
    const t = mountTable({ rows: rowsOf(1), columns: NAME }, { locale: 'es' });
    await settle();
    expect(info(t)).toBe('1 registro');
    expect(t.find('.data-table__pager-nav').exists()).toBe(false);
  });
});

describe('page size', () => {
  it('desk toolbar: a rows-per-page select (10 by default) that pages again from 1 (client)', async () => {
    const t = mountTable({ rows: rowsOf(30), columns: NAME, pageSizeOptions: [10, 25] });
    await settle();
    const select = t.find('.data-table__page-size-select');
    expect(select.attributes('aria-label')).toBe('Rows per page');
    expect((select.element as HTMLElement & { value?: unknown }).value).toBe(10);
    await click(page(t, 2));
    await ionChange(select.element, { value: 25 });
    expect(dataRows(t)).toHaveLength(25);
    expect(info(t)).toContain('1–25 of');
  });

  it('server mode emits pageSizeChange instead', async () => {
    const t = mountTable({ serverSide: true, rows: rowsOf(10), total: 30, columns: NAME });
    await settle();
    await ionChange(t.find('.data-table__page-size-select').element, { value: 50 });
    expect(t.emitted('pageSizeChange')).toEqual([[50]]);
  });

  it('without a toolbar the footer carries a compact native select («10 / page»)', async () => {
    const t = mountTable({ rows: rowsOf(30), columns: NAME, columnPicker: false }, { locale: 'es' });
    await settle();
    expect(t.find('.data-table__bar').exists()).toBe(false);
    const select = t.find('select.data-table__pager-size');
    expect(select.findAll('option').map((o) => o.text())).toEqual(['10 / pág.', '25 / pág.', '50 / pág.', '100 / pág.']);
    await select.setValue('25');
    await settle();
    expect(dataRows(t)).toHaveLength(25);
  });

  it('no options: no selector, and a single page leaves no footer at all', async () => {
    const t = mountTable({ rows: rowsOf(3), columns: NAME, pageSizeOptions: [] });
    await settle();
    expect(t.find('.data-table__page-size-select').exists()).toBe(false);
    expect(t.find('.data-table__pager').exists()).toBe(false);
  });
});

describe('`pageSizeChooser: false`: no «rows per page», the footer still counts (mockups/saas-panel §3b)', () => {
  const BUSINESSES = { one: 'business', many: 'businesses' };

  it('no rows-per-page select in the toolbar; the column chooser is its own switch; the footer counts and pages', async () => {
    const t = mountTable({ rows: rowsOf(25), columns: NAME, pageSizeChooser: false, entityLabel: BUSINESSES });
    await settle();
    expect(t.find('.data-table__page-size-select').exists()).toBe(false);
    expect(t.find('.data-table__columns-select').exists()).toBe(true);
    expect(info(t)).toBe('Showing 1–10 of 25 businesses');
    expect(t.find('.data-table__pager-nav').exists()).toBe(true);
  });

  it('a single page keeps its footer with the count («4 businesses»)', async () => {
    const t = mountTable({ rows: rowsOf(4), columns: NAME, pageSizeChooser: false, entityLabel: BUSINESSES });
    await settle();
    expect(info(t)).toBe('4 businesses');
  });

  it('without a toolbar the footer gets no native select either', async () => {
    const t = mountTable({ rows: rowsOf(30), columns: NAME, columnPicker: false, pageSizeChooser: false });
    await settle();
    expect(t.find('.data-table__bar').exists()).toBe(false);
    expect(t.find('select.data-table__pager-size').exists()).toBe(false);
    expect(info(t)).toBe('Showing 1–10 of 30 records');
  });

  it('while the first rows load without a toolbar there is no footer: nothing to choose, nothing to count yet', async () => {
    const t = mountTable({ serverSide: true, rows: [], total: 0, loading: true, columns: NAME, columnPicker: false, pageSizeChooser: false });
    await settle();
    expect(t.find('.data-table__pager').exists()).toBe(false);
  });
});

describe('phone: «Load more» instead of the numbered pager (#78)', () => {
  beforeEach(() => {
    viewport(true);
  });

  it('client: starts with one page, each tap ADDS one, then goes away; the count stays the total', async () => {
    const t = mountTable({ rows: rowsOf(25), columns: NAME });
    await settle();
    expect(t.find('.data-table__pager-nav').exists()).toBe(false);
    expect(dataRows(t)).toHaveLength(10);
    expect(info(t)).toBe('Showing 1–10 of 25 records');
    await click(loadMore(t));
    expect(dataRows(t)).toHaveLength(20);
    expect(info(t)).toBe('Showing 1–20 of 25 records');
    await click(loadMore(t));
    expect(dataRows(t)).toHaveLength(25);
    expect(loadMore(t)).toBeNull();
  });

  it('a new search starts again at one page', async () => {
    const t = mountTable({ rows: rowsOf(25), columns: NAME, searchKeys: ['name'] });
    await settle();
    await click(loadMore(t));
    await type(t, 'Servicio 1');
    expect(dataRows(t)).toHaveLength(10);
  });

  it('a different result set starts again; the same records refreshed keep the window (hub#2245)', async () => {
    const t = mountTable({ rows: rowsOf(25), columns: NAME });
    await settle();
    await click(loadMore(t));
    await t.setProps({ rows: rowsOf(25).map((r) => (r.id === '15' ? { ...r, name: 'Servicio 15 (instalado)' } : r)) });
    await settle();
    expect(dataRows(t)).toHaveLength(20);
    expect(t.text()).toContain('Servicio 15 (instalado)');
    await t.setProps({ rows: rowsOf(25).reverse() });
    await settle();
    expect(dataRows(t), 'reordered').toHaveLength(10);
    await click(loadMore(t));
    await t.setProps({ rows: rowsOf(26) });
    await settle();
    expect(dataRows(t), 'one more record').toHaveLength(10);
  });

  it('keyless rows cannot be told apart: a refresh starts again', async () => {
    const keyless = () => rowsOf(25).map(({ name }) => ({ name }));
    const t = mountTable({ rows: keyless(), columns: NAME });
    await settle();
    await click(loadMore(t));
    await t.setProps({ rows: keyless() });
    await settle();
    expect(dataRows(t)).toHaveLength(10);
  });

  // The parent keeps the server window live (a bigger `limit` from the first row): it never swaps
  // one page for the next, so every row shown stays reachable and up to date.
  it('server: asks the parent to grow the window (loadMore), never for another page', async () => {
    const t = mountTable({ serverSide: true, rows: rowsOf(10), total: 120, page: 0, columns: NAME, testid: 'items' });
    await settle();
    expect(info(t)).toBe('Showing 1–10 of 120 records');
    await click(loadMore(t));
    expect(t.emitted('loadMore')).toEqual([[]]);
    expect(t.emitted('pageChange')).toBeUndefined();
    await t.setProps({ rows: rowsOf(20) });
    await settle();
    expect(dataRows(t)).toHaveLength(20);
    expect(info(t)).toBe('Showing 1–20 of 120 records');
    expect(byTestId(t, 'items-load-more')).toHaveLength(1);
  });

  it('server: «Load more» goes away once the window holds every row, and the count is the total', async () => {
    const t = mountTable({ serverSide: true, rows: rowsOf(10), total: 12, page: 0, columns: NAME });
    await settle();
    expect(loadMore(t)).not.toBeNull();
    await t.setProps({ rows: rowsOf(12) });
    await settle();
    expect(dataRows(t)).toHaveLength(12);
    expect(info(t)).toBe('Showing 1–12 of 12 records');
    expect(loadMore(t)).toBeNull();
  });

  it('server: crossing the phone breakpoint asks for the first page again when the window is not it', async () => {
    viewport(false);
    const desk = mountTable({ serverSide: true, rows: rowsOf(10, 20), total: 120, page: 2, columns: NAME });
    await settle();
    crossBreakpoint(true);
    await settle();
    expect(desk.emitted('pageChange'), 'a desk on page 3 turned into a phone counts from row 1').toEqual([[0]]);
    desk.unmount();

    viewport(true);
    const phone = mountTable({ serverSide: true, rows: rowsOf(20), total: 120, page: 0, columns: NAME });
    await settle();
    crossBreakpoint(false);
    await settle();
    expect(phone.emitted('pageChange'), 'a grown phone window turned into a desk shrinks to one page').toEqual([[0]]);
    phone.unmount();

    viewport(true);
    const untouched = mountTable({ serverSide: true, rows: rowsOf(10), total: 120, page: 0, columns: NAME });
    await settle();
    crossBreakpoint(false);
    crossBreakpoint(true);
    await settle();
    expect(untouched.emitted('pageChange'), 'the first page alone needs nothing').toBeUndefined();
  });

  it('a desk on page 2 turned into a phone counts from row 1', async () => {
    viewport(false);
    const t = mountTable({ rows: rowsOf(25), columns: NAME });
    await settle();
    await click(page(t, 2));
    crossBreakpoint(true);
    await settle();
    expect(info(t)).toBe('Showing 1–10 of 25 records');
  });

  it('is translated', async () => {
    const t = mountTable({ rows: rowsOf(25), columns: NAME }, { locale: 'es' });
    await settle();
    expect(text(loadMore(t))).toBe('Cargar más');
  });
});

describe('the footer names what it counts: `entityLabel` (§3b: «4 negocios», «12 facturas»)', () => {
  it('`{ one, many }`: the right one for the count, in the count and in the range', async () => {
    const entityLabel = { one: 'negocio', many: 'negocios' };
    const four = mountTable({ rows: rowsOf(4), columns: NAME, entityLabel }, { locale: 'es' });
    const one = mountTable({ rows: rowsOf(1), columns: NAME, entityLabel }, { locale: 'es' });
    const paged = mountTable({ rows: rowsOf(25), columns: NAME, entityLabel }, { locale: 'es' });
    await settle();
    expect(info(four)).toBe('4 negocios');
    expect(info(one)).toBe('1 negocio');
    expect(info(paged)).toBe('Mostrando 1–10 de 25 negocios');
  });

  it('a function of the count (an i18n plural), also in server mode', async () => {
    const entityLabel = (n: number) => (n === 1 ? 'invoice' : 'invoices');
    const t = mountTable({ serverSide: true, rows: rowsOf(10), total: 12, columns: NAME, entityLabel });
    const single = mountTable({ serverSide: true, rows: rowsOf(1), total: 1, columns: NAME, entityLabel });
    await settle();
    expect(info(t)).toBe('Showing 1–10 of 12 invoices');
    expect(info(single)).toBe('1 invoice');
  });

  it('without it the footer keeps saying «records», in each language', async () => {
    const en = mountTable({ rows: rowsOf(2), columns: NAME });
    const es = mountTable({ rows: rowsOf(2), columns: NAME }, { locale: 'es' });
    await settle();
    expect(info(en)).toBe('2 records');
    expect(info(es)).toBe('2 registros');
  });
});
