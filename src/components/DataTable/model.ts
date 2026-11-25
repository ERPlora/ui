// Pure logic of the DataTable, with no DOM and no Vue: what can be proved without a layout engine.
import { type ColumnFit, columnTracks } from './columnTracks';
import type { PagerInput, PagerState } from './pager';
import type { DataTableColumn, DataTableFilterField, DataTableFilters, DataTableRowKey, DataTableSortDir } from './types';

type Fields = Record<string, unknown>;

/** The icons the table chrome paints (`ion:` set, baked by the shell: offline, CSP-safe). */
export const DATA_TABLE_ICONS = {
  sortNone: 'swap-vertical-outline',
  sortAsc: 'chevron-up-outline',
  sortDesc: 'chevron-down-outline',
  previous: 'chevron-back',
  next: 'chevron-forward',
  clear: 'close',
  clearFilters: 'close-circle-outline',
  filters: 'funnel-outline',
  more: 'ellipsis-vertical',
  empty: 'file-tray-outline',
  error: 'alert-circle-outline',
  list: 'list-outline',
  cards: 'grid-outline',
  add: 'add',
} as const;

function fields(row: object): Fields {
  return row as Fields;
}

/** Stable key of a row, as text ('' when the row has none). */
export function rowKeyOf<T extends object>(row: T, rowKey: DataTableRowKey<T>): string {
  const value = typeof rowKey === 'function' ? rowKey(row) : fields(row)[rowKey];
  return value === null || value === undefined ? '' : String(value);
}

/** The text a column paints for a row. `String()`: a module's `format` may hand back a non-string. */
export function cellText<T extends object>(column: DataTableColumn<T>, row: T): string {
  const value = fields(row)[column.key];
  if (column.format) {
    const text: unknown = column.format(value, row);
    return text === null || text === undefined ? '' : String(text);
  }
  return value === null || value === undefined ? '' : String(value);
}

/** A field that holds a number as text: the server sends NUMERIC (money) as «100.00». */
const NUMERIC_TEXT = /^-?\d+(\.\d+)?$/;
/** A field that holds an ISO date, datetime or time («2026-12-31», «09:30:00»). */
const ISO_DATE_OR_TIME = /^(\d{4}-\d{2}-\d{2}|\d{2}:\d{2})/;

/** What a client-side sort compares: `sortValue`, else the field itself when it is DATA (a
 *  number, boolean, `Date`, ISO date/time or NUMERIC string), so «15/01/2027» sorts after
 *  «31/12/2026» and «9,50 €» before «100,00 €». Any other field (words, a code, a missing field, an
 *  object) sorts by the text the person reads. A null field sorts last. */
export function sortKey<T extends object>(column: DataTableColumn<T>, row: T): unknown {
  if (column.sortValue) return column.sortValue(row);
  const value = fields(row)[column.key];
  if (!column.format || value === null) return value;
  if (typeof value === 'number' || typeof value === 'boolean' || value instanceof Date) return value;
  if (typeof value === 'string') {
    if (NUMERIC_TEXT.test(value)) return Number(value);
    if (ISO_DATE_OR_TIME.test(value)) return value;
  }
  return cellText(column, row);
}

export function sortRows<T extends object>(rows: readonly T[], column: DataTableColumn<T>, dir: DataTableSortDir): T[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = sortKey(column, a) as never;
    const vb = sortKey(column, b) as never;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (va < vb) return -1 * sign;
    if (va > vb) return 1 * sign;
    return 0;
  });
}

export function searchRows<T extends object>(rows: readonly T[], keys: readonly string[], needle: string): readonly T[] {
  const wanted = needle.trim().toLowerCase();
  if (!wanted || !keys.length) return rows;
  return rows.filter((row) => keys.some((key) => String(fields(row)[key] ?? '').toLowerCase().includes(wanted)));
}

/** The filters a table offers, as columns: the columns' own, in column order, then each of the page's
 *  `filterFields` as a column of its own (its key, its label, the field itself as its filter). A field
 *  whose key or names in `filters` a column's filter or an earlier field already takes is left out with
 *  a warning in development: the column (or the first field) wins, and no name has two controls. */
export function filterColumnsOf<T>(
  columns: readonly DataTableColumn<T>[],
  fields: readonly DataTableFilterField[] | undefined,
): DataTableColumn<T>[] {
  const own = columns.filter((column) => column.filter);
  const taken = new Set(own.flatMap((column) => [column.key, ...filterKeys(column)]));
  const extra: DataTableColumn<T>[] = [];
  for (const field of fields ?? []) {
    const column: DataTableColumn<T> = { key: field.key, label: field.label, filter: field };
    const names = [field.key, ...filterKeys(column)];
    const clash = names.find((name) => taken.has(name));
    if (clash !== undefined) {
      if (import.meta.env.DEV) console.warn(`DataTable: the filter field «${field.key}» is left out, «${clash}» is already another filter's.`);
      continue;
    }
    names.forEach((name) => taken.add(name));
    extra.push(column);
  }
  return [...own, ...extra];
}

export function filterKeys<T>(column: DataTableColumn<T>): string[] {
  const filter = column.filter;
  if (!filter) return [];
  const key = filter.key ?? column.key;
  if (filter.type === 'range' || filter.type === 'daterange') return filter.keys ? [...filter.keys] : [`${key}_from`, `${key}_to`];
  return [key];
}

/** The filters that filter: a blank value is no filter. */
export function activeFilters(filters: DataTableFilters): DataTableFilters {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value.trim() !== ''));
}

/** The active filters the columns declare, by the name each filter takes: a name no
 *  column declares (a stale one from the address, a page's own parameter) never reaches the server,
 *  which answers 422 `unknown_filter` to it; a blank value is no filter. */
export function declaredFilters<T>(columns: readonly DataTableColumn<T>[], filters: DataTableFilters): DataTableFilters {
  const active = activeFilters(filters);
  const names = new Set(columns.flatMap((column) => filterKeys(column)));
  return Object.fromEntries(Object.entries(active).filter(([name]) => names.has(name)));
}

/** The number on the funnel: the filtered columns (a range counts once, whichever ends it has). */
export function filterCount<T>(columns: readonly DataTableColumn<T>[], filters: DataTableFilters): number {
  const active = activeFilters(filters);
  return columns.filter((column) => filterKeys(column).some((name) => name in active)).length;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** `YYYY-MM-DD` of a date value: a plain date as written, a date-time or a Date by its LOCAL day. */
function dayOf(value: unknown): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : typeof value === 'string' && value ? new Date(value) : undefined;
  if (!date || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function numberOf(value: unknown): number | undefined {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** An end of a range as typed: an amount may carry a decimal comma (`2,50`). */
function endOf(value: string | undefined, amount: boolean): number | undefined {
  return numberOf(amount && value ? value.replace(',', '.') : value);
}

const isOn = (value: unknown): boolean => value === true || value === 'true' || value === 1 || value === '1';

function matchesFilter<T extends object>(column: DataTableColumn<T>, row: T, filters: DataTableFilters): boolean {
  const filter = column.filter;
  if (!filter) return true;
  const key = filter.key ?? column.key;
  const field = fields(row)[key];
  if (filter.type === 'range') {
    const [fromKey, toKey] = filterKeys(column);
    const from = endOf(filters[fromKey], filter.amount === true);
    const to = endOf(filters[toKey], filter.amount === true);
    if (from === undefined && to === undefined) return true;
    const n = numberOf(field);
    return n !== undefined && (from === undefined || n >= from) && (to === undefined || n <= to);
  }
  if (filter.type === 'daterange') {
    const [fromKey, toKey] = filterKeys(column);
    const from = filters[fromKey]?.trim();
    const to = filters[toKey]?.trim();
    if (!from && !to) return true;
    const day = dayOf(field);
    return day !== '' && (!from || day >= from) && (!to || day <= to);
  }
  const wanted = filters[key]?.trim();
  if (!wanted) return true;
  if (filter.type === 'text') {
    const text = filter.key ? String(field ?? '') : cellText(column, row);
    return text.toLowerCase().includes(wanted.toLowerCase());
  }
  if (filter.type === 'date') return dayOf(field) === wanted;
  if (filter.type === 'boolean') return isOn(field) === (wanted === 'true');
  return Array.isArray(field) ? field.some((item) => String(item) === wanted) : String(field ?? '') === wanted;
}

/** Client mode: the rows every active column filter keeps (AND), in order. */
export function filterRows<T extends object>(
  rows: readonly T[],
  columns: readonly DataTableColumn<T>[],
  filters: DataTableFilters,
): readonly T[] {
  const active = activeFilters(filters);
  const filtering = columns.filter((column) => filterKeys(column).some((key) => key in active));
  if (!filtering.length) return rows;
  return rows.filter((row) => filtering.every((column) => matchesFilter(column, row, active)));
}

/** Server mode on a phone, a query longer than the window the parent can hold: it pages as on a desk. */
export function phonePages(input: Pick<PagerInput<unknown>, 'serverSide' | 'isMobile' | 'total' | 'maxWindow'>): boolean {
  return input.serverSide && input.isMobile && input.maxWindow !== undefined && input.total > input.maxWindow;
}

/** What the page shows and what the footer says, for both modes and both viewports. */
export function pagerState<T>(input: PagerInput<T>): PagerState<T> {
  const { serverSide, rows, total, page, pageSize: ps, isMobile, mobileShown } = input;
  const count = serverSide ? total : rows.length;
  const pages = Math.max(1, Math.ceil(count / ps));
  const current = Math.min(page, pages - 1);
  if (phonePages(input)) {
    // A window grown at the end of the scroll before the query outgrew it: its first page only, as the footer says.
    return { visible: rows.slice(0, ps), pages, current, count, rangeFrom: current * ps + 1, rangeTo: Math.min((current + 1) * ps, count), canLoadMore: false };
  }
  if (serverSide && isMobile) {
    // Server mode, windowed (cards, a phone): `rows` is the WINDOW the parent keeps live, from the row of
    // `page` (0 when windowed) and grown one page at the end of the scroll (`loadMore`). The footer and the
    // end of the scroll follow the rows shown against the total; an empty window keeps that page's range.
    const from = current * ps + 1;
    const to = rows.length ? Math.min(from + rows.length - 1, count) : Math.min((current + 1) * ps, count);
    return { visible: rows, pages, current, count, rangeFrom: from, rangeTo: to, canLoadMore: to < count };
  }
  let visible: readonly T[];
  if (serverSide) visible = rows;
  // On a phone the footer accumulates instead of paging.
  else if (isMobile) visible = rows.slice(0, Math.min(mobileShown || ps, count));
  else visible = rows.slice(current * ps, current * ps + ps);
  const served = Math.min(mobileShown || ps, count);
  const canLoadMore = isMobile && served < count;
  // On a phone «to» is what has been served; on desktop, the end of the page.
  const rangeTo = isMobile ? served : Math.min((current + 1) * ps, count);
  // A phone counts from row 1.
  const rangeFrom = isMobile ? 1 : current * ps + 1;
  return { visible, pages, current, count, rangeFrom, rangeTo, canLoadMore };
}

/** Track list of the list view: [checkbox] [columns…] [actions]. */
export function gridTemplate<T>(
  input: ColumnFit & {
    selectable: boolean;
    columns: readonly DataTableColumn<T>[];
    hasActions: boolean;
    actionsTrackPx: number;
  },
): string {
  return [
    input.selectable ? '2.75rem' : null,
    ...columnTracks(input.columns, input),
    // A LENGTH, not `max-content`: header and rows are separate grids sharing this string, and
    // a content-sized track resolves against each one's content (the header slid off its columns).
    // `max-content` only until the first measurement of the buttons lands.
    input.hasActions ? (input.actionsTrackPx > 0 ? `${input.actionsTrackPx}px` : 'max-content') : null,
  ]
    .filter(Boolean)
    .join(' ');
}

/** Same records in the same order, told apart by their key. Keyless rows never match. */
export function sameRecords<T>(before: readonly T[] | undefined, after: readonly T[], keyOf: (row: T) => string): boolean {
  if (!before || before.length !== after.length) return false;
  return after.every((row, i) => {
    const key = keyOf(row);
    return key !== '' && key === keyOf(before[i]);
  });
}
