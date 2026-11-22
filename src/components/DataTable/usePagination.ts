import { computed, type Ref, ref, watch } from 'vue';

import { pagerState, phonePages, sameRecords } from './model';

export interface PaginationSource<T extends object> {
  /** The table's root element (`.data-table`): a phone that pages scrolls back to its top. */
  root: Ref<HTMLElement | null>;
  serverSide: () => boolean;
  /** The `rows` prop. Server mode: the page, or the window, the parent handed over. */
  rows: () => readonly T[];
  /** Client mode: every row left after the search, the column filters and the sort. */
  clientRows: () => readonly T[];
  /** Server mode: records of the whole query. */
  total: () => number;
  /** Server mode: the parent's page, 0-based. */
  page: () => number;
  pageSize: () => number;
  maxWindow: () => number | undefined;
  /** Rows grow from the first one at the end of the scroll (the cards, and a phone's list) instead of paging. */
  windowed: () => boolean;
  keyOf: (row: T) => string;
  /** Server mode: the parent is asked for another page, another page size or a longer window. */
  askPage: (page: number) => void;
  askPageSize: (size: number) => void;
  askMore: () => void;
}

/** The rows on screen: the table's own page and page size (client mode) or the parent's (server mode),
 *  and the rows a windowed table has grown to. */
function pagesShown<T extends object>(source: PaginationSource<T>) {
  const clientPage = ref(0);
  /** 0 = `pageSize`. */
  const clientPageSize = ref(0);
  /** Rows the end of the scroll has accumulated while windowed (0 = one page). */
  const mobileShown = ref(0);
  const pageSizeNow = computed(() => (source.serverSide() ? source.pageSize() : clientPageSize.value || source.pageSize()));
  const pager = computed(() =>
    pagerState({
      serverSide: source.serverSide(),
      rows: source.serverSide() ? source.rows() : source.clientRows(),
      total: source.total(),
      page: source.serverSide() ? source.page() : clientPage.value,
      pageSize: pageSizeNow.value,
      isMobile: source.windowed(),
      mobileShown: mobileShown.value,
      maxWindow: source.maxWindow(),
    }),
  );
  /** Windowed in server mode with a query longer than the parent's window: it pages instead of growing. */
  const phonePaged = computed(() =>
    phonePages({ serverSide: source.serverSide(), isMobile: source.windowed(), total: source.total(), maxWindow: source.maxWindow() }),
  );
  return { clientPage, clientPageSize, mobileShown, pageSizeNow, pager, phonePaged };
}

/** Another page, another page size and more rows at the end of the scroll, and what new rows or crossing the
 *  phone breakpoint do to the rows on screen. */
function pageMoves<T extends object>(source: PaginationSource<T>, shown: ReturnType<typeof pagesShown<T>>) {
  const { clientPage, clientPageSize, mobileShown, pageSizeNow, pager, phonePaged } = shown;
  /** A phone paging past `maxWindow` asked for another page: its rows show from the first once they arrive. */
  let scrollToNewPage = false;
  watch(source.rows, (now, before) => {
    // A phone that pages scrolls WITH the page: tapped at the foot, the new page would open at its end.
    if (scrollToNewPage) {
      scrollToNewPage = false;
      source.root.value?.scrollIntoView({ block: 'start' });
    }
    // A new result set starts at one page; the same records refreshed keep the window.
    if (!source.serverSide() && mobileShown.value !== 0 && !sameRecords(before, now, source.keyOf)) mobileShown.value = 0;
  });
  // A server window is the parent's: a phone counts from row 1 and a desk shows one page, so
  // crossing the breakpoint asks for the first page again unless the window already is just that.
  watch(source.windowed, () => {
    if (source.serverSide() && (source.page() !== 0 || source.rows().length > source.pageSize())) source.askPage(0);
  });

  function goTo(page: number): void {
    if (phonePaged.value) scrollToNewPage = true;
    if (source.serverSide()) source.askPage(page);
    else clientPage.value = page;
  }
  function setPageSize(size: number): void {
    if (source.serverSide()) {
      source.askPageSize(size);
      return;
    }
    clientPageSize.value = size;
    clientPage.value = 0;
    mobileShown.value = 0;
  }
  function loadMore(): void {
    if (source.serverSide()) source.askMore();
    else mobileShown.value = Math.min((mobileShown.value || pageSizeNow.value) + pageSizeNow.value, pager.value.count);
  }
  return { goTo, setPageSize, loadMore };
}

/** The table's pages: the numbered pager of a desk list, and the window of rows that grows at the end of the
 *  scroll in the cards and on a phone (`maxWindow` makes a long server query page there too). */
export function usePagination<T extends object>(source: PaginationSource<T>) {
  const shown = pagesShown(source);
  const { clientPage, mobileShown, pageSizeNow, pager, phonePaged } = shown;
  return { clientPage, mobileShown, pageSizeNow, pager, phonePaged, ...pageMoves(source, shown) };
}
