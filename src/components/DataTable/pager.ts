import type { DataTableEntityLabel } from './types';

/** Pages of the numbered pager (1-based): first, last, neighbours of the current one and «…» in
 *  the jumps. Page 1 of 52 → [1, 2, 3, '…', 52]. */
export function pageList(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const want = new Set<number>([1, total, current, current - 1, current + 1]);
  if (current <= 3) [2, 3].forEach((p) => want.add(p));
  if (current >= total - 2) [total - 1, total - 2].forEach((p) => want.add(p));
  const sorted = [...want].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  let previous = 0;
  for (const page of sorted) {
    if (page - previous > 1) out.push('…');
    out.push(page);
    previous = page;
  }
  return out;
}

export interface PagerInput<T> {
  serverSide: boolean;
  /** Server: the rows the parent handed over (on a phone, the whole window). Client: every row after search and sort. */
  rows: readonly T[];
  /** Server: total of the query. Ignored in client mode (the count is `rows.length`). */
  total: number;
  /** Server: `page` prop. Client: the table's own page. 0-based. */
  page: number;
  pageSize: number;
  isMobile: boolean;
  /** Client mode, windowed: rows the end of the scroll has accumulated (0 = one page). */
  mobileShown: number;
  /** Server mode on a phone: the most rows the parent can hold in one window; a longer query pages. */
  maxWindow?: number;
}

export interface PagerState<T> {
  visible: readonly T[];
  pages: number;
  current: number;
  count: number;
  rangeFrom: number;
  rangeTo: number;
  canLoadMore: boolean;
}

/** The noun the footer counts with («businesses»); `undefined` = the table's own «records». */
export function entityWord(count: number, entity: DataTableEntityLabel | undefined): string | undefined {
  if (!entity) return undefined;
  if (typeof entity === 'function') return entity(count);
  return count === 1 ? entity.one : entity.many;
}
