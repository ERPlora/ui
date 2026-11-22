import { describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';

import { usePagination } from './usePagination';

type Row = { id: string };
const rowsOf = (n: number, offset = 0): Row[] => Array.from({ length: n }, (_, i) => ({ id: String(offset + i + 1) }));
const ids = (rows: readonly Row[]) => rows.map((row) => row.id);

interface Options {
  serverSide?: boolean;
  rows?: Row[];
  /** Client mode: what is left after the search, the filters and the sort (all of `rows` by default). */
  clientRows?: Row[];
  total?: number;
  page?: number;
  maxWindow?: number;
  windowed?: boolean;
}

function setup(options: Options = {}) {
  const rows = ref(options.rows ?? rowsOf(25));
  const clientRows = ref(options.clientRows);
  const page = ref(options.page ?? 0);
  const windowed = ref(options.windowed ?? false);
  const scrollIntoView = vi.fn();
  const asked = { page: vi.fn(), pageSize: vi.fn(), more: vi.fn() };
  const pagination = usePagination<Row>({
    root: ref({ scrollIntoView } as unknown as HTMLElement),
    serverSide: () => options.serverSide ?? false,
    rows: () => rows.value,
    clientRows: () => clientRows.value ?? rows.value,
    total: () => options.total ?? 0,
    page: () => page.value,
    pageSize: () => 10,
    maxWindow: () => options.maxWindow,
    windowed: () => windowed.value,
    keyOf: (row) => row.id,
    askPage: asked.page,
    askPageSize: asked.pageSize,
    askMore: asked.more,
  });
  return { ...pagination, rows, page, windowed, scrollIntoView, asked };
}

describe('usePagination: client mode', () => {
  it('pages the rows left after the search and the filters, and moves between them on its own', () => {
    const p = setup({ clientRows: rowsOf(14) });
    expect(ids(p.pager.value.visible)).toEqual(ids(rowsOf(10)));
    expect([p.pager.value.pages, p.pager.value.count]).toEqual([2, 14]);
    p.goTo(1);
    expect(ids(p.pager.value.visible)).toEqual(ids(rowsOf(4, 10)));
    expect(p.clientPage.value).toBe(1);
    expect(p.asked.page).not.toHaveBeenCalled();
  });

  it('a new page size pages again from the first page, with that size', () => {
    const p = setup();
    p.goTo(2);
    p.setPageSize(25);
    expect([p.pageSizeNow.value, p.clientPage.value, p.pager.value.visible.length]).toEqual([25, 0, 25]);
    expect(p.asked.pageSize).not.toHaveBeenCalled();
  });

  it('windowed: each end of the scroll adds one page, never past the last row', () => {
    const p = setup({ windowed: true });
    expect(p.pager.value.visible).toHaveLength(10);
    p.loadMore();
    expect([p.mobileShown.value, p.pager.value.visible.length]).toEqual([20, 20]);
    p.loadMore();
    expect([p.mobileShown.value, p.pager.value.canLoadMore]).toEqual([25, false]);
    expect(p.asked.more).not.toHaveBeenCalled();
  });

  it('windowed: a new page size starts a grown window again', () => {
    const p = setup({ windowed: true });
    p.loadMore();
    p.setPageSize(25);
    expect(p.mobileShown.value).toBe(0);
  });

  it('windowed: other records start the window again; the same records refreshed keep it', async () => {
    const p = setup({ windowed: true });
    p.loadMore();
    p.rows.value = rowsOf(25).map((row) => ({ ...row }));
    await nextTick();
    expect(p.mobileShown.value).toBe(20);
    p.rows.value = rowsOf(25, 100);
    await nextTick();
    expect(p.mobileShown.value).toBe(0);
  });

  it('crossing the phone breakpoint asks the parent for nothing: the pages are the table’s', async () => {
    const p = setup();
    p.goTo(1);
    p.windowed.value = true;
    await nextTick();
    expect(p.asked.page).not.toHaveBeenCalled();
  });
});

describe('usePagination: server mode', () => {
  it('the page, the page size and more rows are asked for; the rows and the page are the parent’s', () => {
    const p = setup({ serverSide: true, rows: rowsOf(10, 10), total: 25, page: 1 });
    expect([p.pager.value.current, p.pager.value.rangeFrom, ids(p.pager.value.visible)]).toEqual([1, 11, ids(rowsOf(10, 10))]);
    p.goTo(2);
    p.setPageSize(25);
    p.loadMore();
    expect([p.asked.page.mock.calls, p.asked.pageSize.mock.calls, p.asked.more.mock.calls]).toEqual([[[2]], [[25]], [[]]]);
    expect([p.clientPage.value, p.pageSizeNow.value, p.mobileShown.value]).toEqual([0, 10, 0]);
  });

  it('crossing the breakpoint asks for the first page again unless the window already is just that', async () => {
    const later = setup({ serverSide: true, rows: rowsOf(10), total: 40, page: 1 });
    later.windowed.value = true;
    await nextTick();
    expect(later.asked.page.mock.calls).toEqual([[0]]);
    const grown = setup({ serverSide: true, rows: rowsOf(20), total: 40, windowed: true });
    grown.windowed.value = false;
    await nextTick();
    expect(grown.asked.page.mock.calls).toEqual([[0]]);
    const first = setup({ serverSide: true, rows: rowsOf(10), total: 40 });
    first.windowed.value = true;
    await nextTick();
    expect(first.asked.page).not.toHaveBeenCalled();
  });

  it('windowed past `maxWindow`: it pages, and the list scrolls to its top once the asked page arrives', async () => {
    const p = setup({ serverSide: true, rows: rowsOf(10), total: 60, maxWindow: 25, windowed: true });
    expect([p.phonePaged.value, p.pager.value.canLoadMore]).toEqual([true, false]);
    p.rows.value = rowsOf(10);
    await nextTick();
    expect(p.scrollIntoView).not.toHaveBeenCalled();
    p.goTo(1);
    p.rows.value = rowsOf(10, 10);
    await nextTick();
    p.rows.value = rowsOf(10, 10);
    await nextTick();
    expect(p.scrollIntoView.mock.calls).toEqual([[{ block: 'start' }]]);
  });

  it('a desk past `maxWindow` keeps its numbered pager and never scrolls on a new page', async () => {
    const p = setup({ serverSide: true, rows: rowsOf(10), total: 60, maxWindow: 25 });
    expect(p.phonePaged.value).toBe(false);
    p.goTo(1);
    p.rows.value = rowsOf(10, 10);
    await nextTick();
    expect(p.scrollIntoView).not.toHaveBeenCalled();
  });
});
