// Pure logic of the DataTable, ported 1:1 from OutfitKit's `ok-data-table.ts` (the issue numbers in
// the comments are of ERPlora/outfitkit unless they say otherwise). No DOM, no Vue: what can be
// proved without a layout engine lives here.
import type {
  DataTableAction,
  DataTableColumn,
  DataTableEntityLabel,
  DataTableFilterField,
  DataTableFilters,
  DataTableRowKey,
  DataTableSortDir,
} from './types';

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

/** The fields of a row, for the reads the column API declares by key. */
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

/** #256 - A field that holds a number as text: the hub decodes NUMERIC (money) to «100.00». */
const NUMERIC_TEXT = /^-?\d+(\.\d+)?$/;
/** #256 - A field that holds an ISO date, datetime or time («2026-12-31», «09:30:00»). */
const ISO_DATE_OR_TIME = /^(\d{4}-\d{2}-\d{2}|\d{2}:\d{2})/;

/** #256 - What a client-side sort compares: `sortValue`, else the field itself when it is DATA (a
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

/** Rows sorted by a column, in a new array (the rows given are never mutated). */
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

/** Client-side search: rows whose `keys` contain the needle (case-insensitive). */
export function searchRows<T extends object>(rows: readonly T[], keys: readonly string[], needle: string): readonly T[] {
  const wanted = needle.trim().toLowerCase();
  if (!wanted || !keys.length) return rows;
  return rows.filter((row) => keys.some((key) => String(fields(row)[key] ?? '').toLowerCase().includes(wanted)));
}

/** Pages of the numbered pager (1-based): first, last, neighbours of the current one and «…» in
 *  the jumps. Page 1 of 52 → [1, 2, 3, '…', 52]. */
// ── Column filters ──────────────────────────────────────────────────────────────────────────
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

/** The names a column's filter takes in `filters` (none without a filter). */
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

/** outfitkit#116 - The active filters the columns declare, by the name each filter takes: a name no
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

/** A number of a range end or a row field; `undefined` when there is none. */
function numberOf(value: unknown): number | undefined {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** An end of a range as typed: an amount may carry a decimal comma (`2,50`). */
function endOf(value: string | undefined, amount: boolean): number | undefined {
  return numberOf(amount && value ? value.replace(',', '.') : value);
}

/** A yes/no field: on when `true`, `'true'`, `1` or `'1'`. */
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
  return String(field ?? '') === wanted;
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
  /** #78 - Client mode on a phone: rows «Load more» has accumulated (0 = one page). */
  mobileShown: number;
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

/** What the page shows and what the footer says, for both modes and both viewports. */
export function pagerState<T>(input: PagerInput<T>): PagerState<T> {
  const { serverSide, rows, total, page, pageSize: ps, isMobile, mobileShown } = input;
  const count = serverSide ? total : rows.length;
  const pages = Math.max(1, Math.ceil(count / ps));
  const current = Math.min(page, pages - 1);
  if (serverSide && isMobile) {
    // #78 - Server mode on a phone: `rows` is the WINDOW the parent keeps live, from the row of
    // `page` (0 on a phone) and grown one page per «Load more» (`loadMore`). The footer and «Load
    // more» follow the rows shown against the total; an empty window keeps that page's range.
    const from = current * ps + 1;
    const to = rows.length ? Math.min(from + rows.length - 1, count) : Math.min((current + 1) * ps, count);
    return { visible: rows, pages, current, count, rangeFrom: from, rangeTo: to, canLoadMore: to < count };
  }
  let visible: readonly T[];
  if (serverSide) visible = rows;
  // #78 - On a phone the footer accumulates instead of paging.
  else if (isMobile) visible = rows.slice(0, Math.min(mobileShown || ps, count));
  else visible = rows.slice(current * ps, current * ps + ps);
  // #78 - How many rows a phone (client) has been served, and whether anything is left.
  const served = Math.min(mobileShown || ps, count);
  const canLoadMore = isMobile && served < count;
  // hub#1984 - On a phone «to» is what has been served; on desktop, the end of the page.
  const rangeTo = isMobile ? served : Math.min((current + 1) * ps, count);
  // hub#2365 - A phone counts from row 1.
  const rangeFrom = isMobile ? 1 : current * ps + 1;
  return { visible, pages, current, count, rangeFrom, rangeTo, canLoadMore };
}

/** Track list of the list view: [checkbox] [columns…] [actions]. */
export function gridTemplate<T>(input: {
  selectable: boolean;
  columns: readonly DataTableColumn<T>[];
  hasActions: boolean;
  actionsTrackPx: number;
}): string {
  return [
    input.selectable ? '2.75rem' : null,
    // #120 - 5.5rem (88px) is the narrowest a data column stays readable.
    ...input.columns.map((c) => c.width ?? 'minmax(5.5rem,1fr)'),
    // #121 - A LENGTH, not `max-content`: header and rows are separate grids sharing this string, and
    // a content-sized track resolves against each one's content (the header slid off its columns).
    // `max-content` only until the first measurement of the buttons lands.
    input.hasActions ? (input.actionsTrackPx > 0 ? `${input.actionsTrackPx}px` : 'max-content') : null,
  ]
    .filter(Boolean)
    .join(' ');
}

/** #205 - The column a card title already shows, so the default card body does not repeat it: the
 *  first visible column whose text reads exactly like the title. Only text titles; a column painted
 *  by a slot is never matched (the table cannot tell what it paints). */
export function cardTitleColumn<T extends object>(
  title: unknown,
  row: T,
  columns: readonly DataTableColumn<T>[],
): DataTableColumn<T> | undefined {
  if (typeof title !== 'string' && typeof title !== 'number') return undefined;
  const text = String(title).trim();
  if (!text) return undefined;
  return columns.find((c) => !c.cell && cellText(c, row).trim() === text);
}

/** hub#2014 - The row actions that exist for THIS row (`hidden` filtered out), in order. */
export function visibleActions<T>(actions: readonly DataTableAction<T>[], row: T): DataTableAction<T>[] {
  return actions.filter((a) => a.hidden?.(row) !== true);
}

/** #240 - The actions that get a column in the list: those at least one row shows. */
export function slotActions<T>(actions: readonly DataTableAction<T>[], rows: readonly T[]): DataTableAction<T>[] {
  return actions.filter((a) => rows.some((row) => a.hidden?.(row) !== true));
}

/** §6.16 - An icon action that also paints its label (`showLabel`). */
export function iconWithLabel<T>(action: DataTableAction<T>): boolean {
  return !!action.icon && action.showLabel === true;
}

/** #213 - Are these row actions folded into the «…» menu? Only when the list folds (#122) AND there
 *  is more than one, or a single action with text (wider than the «…» button itself). */
export function rowActionsFolded<T>(collapsed: boolean, actions: readonly DataTableAction<T>[]): boolean {
  return collapsed && (actions.length > 1 || (actions.length === 1 && (!actions[0].icon || iconWithLabel(actions[0]))));
}

/** W-19 - How far the row actions are folded into «⋮»: not at all, beyond `maxInlineActions`, or all
 *  but the pinned ones. */
export type RowActionsFold = 'none' | 'extra' | 'all';

/** W-19 - The actions that keep a button at a fold, in their order. A `menuOnly` one never does; a
 *  `pinned` one always does (and takes one of the `maxInline` places first). */
export function inlineActions<T>(actions: readonly DataTableAction<T>[], fold: RowActionsFold, maxInline: number): DataTableAction<T>[] {
  const candidates = actions.filter((a) => a.menuOnly !== true);
  if (fold === 'none') return candidates;
  if (fold === 'all') return candidates.filter((a) => a.pinned === true);
  let room = Math.max(0, maxInline - candidates.filter((a) => a.pinned === true).length);
  return candidates.filter((a) => a.pinned === true || room-- > 0);
}

/** §3b - The noun the footer counts with («negocios»); `undefined` = the table's own «records». */
export function entityWord(count: number, entity: DataTableEntityLabel | undefined): string | undefined {
  if (!entity) return undefined;
  if (typeof entity === 'function') return entity(count);
  return count === 1 ? entity.one : entity.many;
}

/** The text of a row action for a row. */
export function actionLabel<T>(action: DataTableAction<T>, row: T): string {
  return typeof action.label === 'function' ? action.label(row) : action.label;
}

/** Ionic 8 default palette, the last fallback when the theme does not define the token. */
const DEFAULT_HEX: Record<string, string> = {
  primary: '#0054e9',
  secondary: '#0163aa',
  tertiary: '#6030ff',
  success: '#2dd55b',
  warning: '#ffc409',
  danger: '#c5000f',
  light: '#f4f5f8',
  medium: '#636469',
  dark: '#222428',
};

/** A theme colour name: lowercase, digits and dashes. Anything else is refused (it goes into CSS). */
const TONE_NAME = /^[a-z][a-z0-9-]*$/;

/** #162 - Inline style that paints a control with a theme tone: `clear` for an `ion-button`
 *  `fill="clear"` (its `--color`), `text` for an `ion-icon`/`ion-label` (`color`). Inline, because
 *  the row menu popover is teleported out of the table. `undefined` for an empty or unsafe tone. */
export function toneStyle(tone: string | undefined, variant: 'clear' | 'text'): string | undefined {
  if (!tone || !TONE_NAME.test(tone)) return undefined;
  const hex = DEFAULT_HEX[tone];
  const value = `var(--ion-color-${tone}${hex ? `, ${hex}` : ''})`;
  return variant === 'clear' ? `--color: ${value};` : `color: ${value};`;
}

/** hub#2245 - Same records in the same order, told apart by their key. Keyless rows never match. */
export function sameRecords<T>(before: readonly T[] | undefined, after: readonly T[], keyOf: (row: T) => string): boolean {
  if (!before || before.length !== after.length) return false;
  return after.every((row, i) => {
    const key = keyOf(row);
    return key !== '' && key === keyOf(before[i]);
  });
}
