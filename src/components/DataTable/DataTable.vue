<script setup lang="ts" generic="T extends object">
// DataTable — the record list of ERPlora: Vue port of OutfitKit's `ok-data-table` (PLAN §16.11),
// visually identical. Same DOM structure and CSS (`:host` → `.data-table`, classes renamed to
// `data-table__*`), Ionic controls inside, no network and no business logic.
//
// Two modes, as the original:
//   - client (default): `rows` holds every record; search (`searchKeys`), sort and paging in memory;
//   - server (`serverSide`): `rows` is the current page; sort, page and page size are asked for with
//     events and the parent queries again. On a phone there is no pager: `rows` is a WINDOW from the
//     first row that «Load more» asks the parent to grow by one page (`loadMore`, never `pageChange`),
//     and crossing the phone breakpoint asks for the first page again (`pageChange(0)`) whenever the
//     window is not just that page. `update:search` is emitted in both modes (v-model).
// Toolbar order is FIXED (the same in every list): search · the `filters` slot · ‹spacer› · column
// chooser · rows per page · list/cards segment · create · primary action · the `toolbar` slot.
// Column filters (`DataTableColumn.filter`): a filter row under the toolbar's main row, one Ionic
// control per filtered column, in column order (free text «contains», a closed domain by equality,
// a day, a numeric range), and «Clear filters» while any filters. It lives in the toolbar area, not
// under the column headers, so it is there in the cards, in an empty result and on a phone.
// Client mode filters `rows` (with the search, AND); server mode emits `filtersChange` with the
// active filters by name and filters nothing. `v-model:filters` in both, as `search`.
// `pageSizeChooser: false` drops «rows per page» (the footer still counts and pages);
// `hideToolbarWhenEmpty` paints a list with no record as its empty state alone, without toolbar
// nor footer (mockups/saas-panel §6.16): its `empty` slot then offers the create action.
// Hooks (`testid`): `<testid>-search`, `-add`, `-view`, `-row` (every row and card, key in `data-id`),
// `-row-<key>-<action>`, `-loading`, `-retry`, `-page-prev`, `-page-next`, `-filters`,
// `-filter-<name>` (a range: `-filter-<key>_from`, `-filter-<key>_to`), `-filters-clear`…
//
// Slots: `filters` (the page's filters, next to the search, as Odoo or Shopify place them),
// `toolbar` (extra header actions), `row-actions` ({ row }), `card` ({ row }, the card body),
// `empty` (content of the empty state), and one per column that declares `cell` ({ row, value, column }).
//
// Fitting the box (W-19, mockups/saas-panel §3b). What fits is decided by the table's OWN box (a
// ResizeObserver on it), never by the window: with the side menu open the box is far narrower than
// the screen. When the list does not fit, it gives up one thing at a time and takes it back as the
// box widens, in this order:
//   1. the columns with `priority: 'low'` (the person can pick them back in the column chooser, and
//      the cards still show them);
//   2. the row actions beyond `maxInlineActions` (2), into the row's «⋮» menu;
//   3. every row action that is not `pinned`;
//   4. the list itself: cards, when `views` offers them and the person has not picked a view by hand.
// Only then does the list scroll sideways INSIDE its box (`data-table__scroll--overflow`); the page
// never does. `cardBreakpoint` is the floor under all of this: at or below that window width (a
// phone) the table is cards whatever its box.
//
// Row actions: declare them in `actions`, so they fold. The main one of the row («Open», «Pay»)
// goes `pinned`; the delicate ones («Transfer ownership») go `menuOnly` and live in «⋮» in the list
// and in the cards (the page confirms them). The `row-actions` slot paints its content as is, at any
// width: it never folds, so it is only for a control that cannot be an action (and the table cannot
// make room by folding what it paints). An icon action is an icon-only button unless `showLabel`
// (icon and text, as the mockups paint «Open» or «Pay»); the «⋮» menu always shows the labels.
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCheckbox,
  IonChip,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonPopover,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from '@ionic/vue';
import { computed, onMounted, onUpdated, ref, shallowRef, watch } from 'vue';

import { ionIconSrc } from '../../shell/icons';
import { useDataTableLabels } from './labels';
import {
  actionLabel,
  activeFilters,
  cardTitleColumn as titleColumnByText,
  cellText,
  DATA_TABLE_ICONS,
  entityWord,
  filterKeys,
  filterRows,
  gridTemplate,
  iconWithLabel,
  inlineActions,
  pageList,
  pagerState,
  rowActionsFolded,
  rowKeyOf,
  type RowActionsFold,
  sameRecords,
  searchRows,
  slotActions as slotActionsOf,
  sortRows,
  toneStyle,
  visibleActions,
} from './model';
import { syncSearchbarInputName } from './searchbarName';
import type {
  DataTableAction,
  DataTableActionEvent,
  DataTableColumn,
  DataTableEntityLabel,
  DataTableFilters,
  DataTableLabels,
  DataTablePrimaryAction,
  DataTableRowKey,
  DataTableSort,
  DataTableSortDir,
  DataTableView,
} from './types';
import { type DataTableFitStep, useDataTableLayout } from './useDataTableLayout';

const props = withDefaults(
  defineProps<{
    /** Columns to paint, in order. */
    columns: DataTableColumn<T>[];
    /** The records. Server mode: only the current page. */
    rows: T[];
    /** Stable key of a row: a field or a function (`id` by default). */
    rowKey?: DataTableRowKey<T>;
    /** Rows per page. */
    pageSize?: number;
    /** Options of the rows-per-page selector; empty = no selector (and no footer on a single page). */
    pageSizeOptions?: number[];
    /** The rows-per-page selector (on by default). Off: no selector, and the footer still counts. */
    pageSizeChooser?: boolean;
    /** No rows at all. Default: the «No results» label. */
    emptyMessage?: string;
    /** Client mode: rows exist but the search hides them all. Default: the «noMatches» label. */
    noMatchesMessage?: string;
    /** Why the rows could not be loaded: an error state with «Retry» (emits `retry`) instead of rows. */
    error?: string;
    /** The rows are being loaded: an indicator instead of «empty»; rows on screen stay (busy). */
    loading?: boolean;
    /** Server mode: show the search box (client mode shows it with `searchKeys`). */
    searchable?: boolean;
    /** Client mode: fields the search box filters on. */
    searchKeys?: string[];
    /** Hint of the search box. Default: the «Search…» label. */
    searchPlaceholder?: string;
    /** `v-model:search`. `undefined` = not controlled: the table keeps what is typed. */
    search?: string;
    /** `v-model:filters` (the column filters by name). `undefined` = not controlled. */
    filters?: DataTableFilters;
    /** Sort, page and search are the parent's: they are emitted, never applied to `rows`. */
    serverSide?: boolean;
    /** Server mode: records of the whole query. */
    total?: number;
    /** Server mode: current page, 0-based. */
    page?: number;
    /** Server mode: active sort column. */
    sort?: string;
    /** Server mode: direction of the active sort. */
    sortDir?: DataTableSortDir;
    /** Overrides of the chrome texts for this table (the rest come from i18n). */
    labels?: Partial<DataTableLabels>;
    /** Row action buttons (emit `action`). Every row action goes here, not in the `row-actions`
     *  slot: these fold into «⋮» when the box is narrow (W-19). Mark the row's main one `pinned`
     *  (it never folds) and a delicate one `menuOnly` (never a button). */
    actions?: DataTableAction<T>[];
    /** W-19 - Buttons a row keeps at the first fold; the rest go into «⋮» (a `pinned` one counts
     *  and always stays). Only applies when the list does not fit: with room, every action shows. */
    maxInlineActions?: number;
    /** A labelled create button in the toolbar (emits `add`). */
    addable?: boolean;
    /** The highlighted button of the toolbar (emits `primaryAction`). */
    primaryAction?: DataTablePrimaryAction;
    /** The visible-columns chooser (on by default). */
    columnPicker?: boolean;
    /** A list with no record at all (loaded, nothing searched) paints only its empty state: no
     *  toolbar, no footer. A load, a failure or a search that finds nothing keep the toolbar. */
    hideToolbarWhenEmpty?: boolean;
    /** Fill the container's height: rows scroll inside, toolbar and footer stay. */
    fill?: boolean;
    /** Heading of the toolbar, with the record count. */
    title?: string;
    /** List/cards switch: `true` or the views offered. Cards are only shown when declared here. */
    views?: boolean | DataTableView[];
    /** Starting view. */
    defaultView?: DataTableView;
    /** The whole row (and card) opens the record: emits `rowClick`, also on Enter/Space. */
    rowClickable?: boolean;
    /** Row selection with checkboxes and a selection bar. */
    selectable?: boolean;
    /** `v-model:selected` (row keys). `undefined` = the table keeps its own selection. */
    selected?: string[];
    /** Card title. */
    cardTitle?: (row: T) => string | number | null | undefined;
    /** Key of the column the card title stands for: never repeated in the card body, even when the
     *  title's text is not that column's (a name over a code). Without `cardTitle`, the title is
     *  that column's painted text. Without it, the body leaves out the column whose text IS the
     *  title (#205). */
    cardTitleColumn?: string;
    /** Card icon name. */
    cardIcon?: (row: T) => string | undefined;
    /** Phone breakpoint in px of the WINDOW (640 by default): at or below it the table behaves as on a
     *  phone (cards when `views` offers them, «Load more», no column chooser). Per table: raise it for
     *  a wide list (Businesses 900, Members or Invoices 1100…). It is a floor: above it the cards
     *  still come when the list does not fit its own box (W-19). */
    cardBreakpoint?: number;
    /** What the footer counts: `{ one, many }` or a function of the count returning the noun
     *  («4 businesses», «1 invoice»). Default: the «record(s)» label. */
    entityLabel?: DataTableEntityLabel;
    /** Prefix of the `data-testid` hooks; none without it. */
    testid?: string;
  }>(),
  {
    rowKey: 'id' as never,
    pageSize: 10,
    pageSizeOptions: () => [10, 25, 50, 100],
    pageSizeChooser: true,
    emptyMessage: undefined,
    noMatchesMessage: undefined,
    error: undefined,
    searchKeys: () => [],
    searchPlaceholder: undefined,
    search: undefined,
    filters: undefined,
    total: 0,
    page: 0,
    sort: undefined,
    sortDir: 'asc',
    labels: undefined,
    actions: () => [],
    maxInlineActions: 2,
    primaryAction: undefined,
    columnPicker: true,
    title: '',
    views: false,
    defaultView: undefined,
    selected: undefined,
    cardTitle: undefined,
    cardTitleColumn: undefined,
    cardIcon: undefined,
    cardBreakpoint: 640,
    entityLabel: undefined,
    testid: undefined,
  },
);

const emit = defineEmits<{
  rowClick: [row: T];
  action: [event: DataTableActionEvent<T>];
  sortChange: [sort: DataTableSort];
  pageChange: [page: number];
  /** Server mode, phone: grow the window of `rows` by one page, from the first row. */
  loadMore: [];
  pageSizeChange: [size: number];
  'update:search': [value: string];
  'update:filters': [filters: DataTableFilters];
  /** Server mode: the column filters changed; query again with these (the active ones, by name). */
  filtersChange: [filters: DataTableFilters];
  'update:selected': [keys: string[]];
  columnsChange: [visible: string[]];
  viewChange: [view: DataTableView];
  add: [];
  primaryAction: [];
  retry: [];
}>();

type RowSlot = (props: { row: T }) => unknown;
/** A column's `cell` slot (any name a column declares). */
type CellSlot = (props: { row: T; value: unknown; column: DataTableColumn<T> }) => unknown;
const slots = defineSlots<{
  /** The page's filters (a status select…): right after the search box. */
  filters?(): unknown;
  toolbar?(): unknown;
  'row-actions'?: RowSlot;
  card?: RowSlot;
  /** Replaces the content of the empty state (the search is the page's, through v-model:search). */
  empty?(): unknown;
  [cell: string]: CellSlot | undefined;
}>();

const ICONS = DATA_TABLE_ICONS;
const icon = ionIconSrc;
const root = ref<HTMLElement | null>(null);
const { text: label } = useDataTableLabels(() => props.labels);

// ── Own state (client mode) ───────────────────────────────────────────────────────────────────
const q = ref('');
const clientPage = ref(0);
/** 0 = `pageSize`. */
const clientPageSize = ref(0);
/** #78 - Rows «Load more» has accumulated on a phone (0 = one page). */
const mobileShown = ref(0);
const clientSort = ref('');
const clientSortDir = ref<DataTableSortDir>('asc');
/** The person's pick in the column chooser, per key; untouched columns follow their `hidden`. */
const columnChoice = ref(new Map<string, boolean>());
const internalSelection = ref(new Set<string>());
/** #217 - Cells unfolded by a tap, as `rowKey + U+241F + column key`. */
const unfoldedCells = ref(new Set<string>());
let lastPointerType = '';
const rowMenuOpen = ref(false);
const rowMenuEvent = shallowRef<Event>();
const rowMenuRow = shallowRef<T>();

const keyOf = (row: T): string => rowKeyOf(row, props.rowKey ?? ('id' as DataTableRowKey<T>));
const fieldOf = (row: T, key: string): unknown => (row as Record<string, unknown>)[key];
const tid = (suffix: string): string | undefined => {
  const prefix = props.testid?.trim();
  return prefix ? `${prefix}-${suffix}` : undefined;
};

/** Columns the person sees: their `hidden`, unless picked otherwise in the column chooser. */
const visibleColumns = computed(() => props.columns.filter((c) => columnChoice.value.get(c.key) ?? c.hidden !== true));
/** W-19 - Shown columns the box may take away: `low`, and not picked by hand. */
const yieldingColumns = computed(() =>
  visibleColumns.value.filter((c) => c.priority === 'low' && columnChoice.value.get(c.key) !== true),
);
const hasSearch = computed(() => props.searchable || props.searchKeys.length > 0);
const viewToggle = computed(() => (Array.isArray(props.views) ? props.views.length > 1 : props.views === true));
const cardViewEnabled = computed(() => (Array.isArray(props.views) ? props.views.includes('cards') : props.views === true));
const hasActions = computed(() => props.actions.length > 0 || !!slots['row-actions']);
/** #240 - The actions that get a place in the list: those some row shows. */
const slotActions = computed(() => slotActionsOf(props.actions, props.rows));
/** W-19 - The ladder of THIS table: only the steps that free something. */
const fitSteps = computed(() => {
  const steps: DataTableFitStep[] = [];
  if (yieldingColumns.value.length) steps.push('hideLow');
  const max = props.maxInlineActions;
  if (inlineActions(slotActions.value, 'extra', max).length < inlineActions(slotActions.value, 'none', max).length) steps.push('foldExtra');
  if (hasActions.value) steps.push('foldAll');
  return steps;
});
/** The ladder by content: new rows that keep it do not make the box be judged again. */
const fitStepsKey = computed(() => fitSteps.value.join());

const layout = useDataTableLayout({
  root,
  cardBreakpoint: () => props.cardBreakpoint,
  cardViewEnabled: () => cardViewEnabled.value,
  defaultView: () => props.defaultView,
  hasActions: () => hasActions.value,
  fitSteps: () => fitSteps.value,
  deps: () => [props.columns, props.actions, columnChoice.value, props.selectable, props.maxInlineActions, fitStepsKey.value],
  shape: () =>
    JSON.stringify([
      visibleColumns.value.map((c) => [c.key, c.width ?? '', yieldingColumns.value.includes(c)]),
      props.actions.map((a) => [a.id, !!a.icon, !!a.showLabel, !!a.pinned, !!a.menuOnly]),
      props.selectable,
      props.maxInlineActions,
    ]),
  fill: () => props.fill,
});
const {
  viewMode,
  isMobile,
  xOverflow,
  actionsTrackPx,
  actionsLabelFits,
  rowActionsCollapsed,
  lowColumnsHidden,
  extraActionsFolded,
  contentAfter,
} = layout;
/** W-19 - The list's columns: the visible ones, minus the yielding ones while the box hides them. */
const listColumns = computed(() =>
  lowColumnsHidden.value ? visibleColumns.value.filter((c) => !yieldingColumns.value.includes(c)) : visibleColumns.value,
);

// ── Column filters ────────────────────────────────────────────────────────────────────────────
/** The active filters on screen (own state; `filters` from the parent overrides it, like `search`). */
const filterValues = ref<DataTableFilters>({});
const filterColumns = computed(() => props.columns.filter((c) => c.filter));
const filtering = computed(() => Object.keys(filterValues.value).length > 0);
/** The name of a column's (single) filter in `filters`. */
const filterName = (column: DataTableColumn<T>): string => filterKeys(column)[0] ?? column.key;
const sameFilters = (a: DataTableFilters, b: DataTableFilters): boolean => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
};

function setFilters(next: DataTableFilters): void {
  const active = activeFilters(next);
  if (sameFilters(active, filterValues.value)) return;
  filterValues.value = active;
  if (!props.serverSide) {
    clientPage.value = 0;
    mobileShown.value = 0;
  }
  emit('update:filters', active);
  if (props.serverSide) emit('filtersChange', active);
}
/** Ionic's `ionInput` (text, range) or `ionChange` (select, date) of one filter control. */
function onFilter(name: string, ev: CustomEvent<{ value?: unknown }>): void {
  const value = ev.detail.value;
  setFilters({ ...filterValues.value, [name]: value === null || value === undefined ? '' : String(value) });
}
function clearFilters(): void {
  setFilters({});
}
/** A range's two ends: their names, their hints and their accessible names. */
function rangeEnds(column: DataTableColumn<T>): Array<{ name: string; hint: string; named: string }> {
  const [from, to] = filterKeys(column);
  return [
    { name: from, hint: label('filterFrom'), named: label('filterFromOf', { label: column.label }) },
    { name: to, hint: label('filterTo'), named: label('filterToOf', { label: column.label }) },
  ];
}

// ── Rows on screen ────────────────────────────────────────────────────────────────────────────
const clientRows = computed(() => {
  const found = filterRows(searchRows(props.rows, props.searchKeys, q.value), props.columns, filterValues.value);
  const column = clientSort.value ? props.columns.find((c) => c.key === clientSort.value) : undefined;
  return column ? sortRows(found, column, clientSortDir.value) : found;
});
const pageSizeNow = computed(() => (props.serverSide ? props.pageSize : clientPageSize.value || props.pageSize));
const pager = computed(() =>
  pagerState({
    serverSide: props.serverSide,
    rows: props.serverSide ? props.rows : clientRows.value,
    total: props.total,
    page: props.serverSide ? props.page : clientPage.value,
    pageSize: pageSizeNow.value,
    isMobile: isMobile.value,
    mobileShown: mobileShown.value,
  }),
);

const hasError = computed(() => !!props.error?.trim());
/** #268 - A load in flight with nothing current to show (no rows yet, or only the failure). */
const awaitingRows = computed(() => props.loading && (props.rows.length === 0 || hasError.value));
/** pm#530 - The last load failed: rows, «empty» and counts would all be claims about missing data. */
const loadFailed = computed(() => hasError.value && !awaitingRows.value);
/** The toolbar the props ask for (an empty list may still leave it out: `bareEmpty`). */
const hasToolbar = computed(
  () =>
    !!props.title ||
    hasSearch.value ||
    viewToggle.value ||
    props.columnPicker ||
    props.addable ||
    !!props.primaryAction ||
    filterColumns.value.length > 0 ||
    !!slots.filters ||
    !!slots.toolbar,
);
/** §6.16 - `hideToolbarWhenEmpty` and no record at all: loaded, not failed, nothing searched. */
const bareEmpty = computed(
  () =>
    props.hideToolbarWhenEmpty &&
    !awaitingRows.value &&
    !loadFailed.value &&
    props.rows.length === 0 &&
    (!props.serverSide || props.total === 0) &&
    !q.value.trim() &&
    !filtering.value,
);
const showTopbar = computed(() => hasToolbar.value && !bareEmpty.value);
/** The rows-per-page selector exists (toolbar on a desk, else the footer). */
const pageSizeSelectable = computed(() => props.pageSizeChooser && props.pageSizeOptions.length > 0);
const showPager = computed(
  () =>
    !loadFailed.value &&
    !bareEmpty.value &&
    (awaitingRows.value
      ? !hasToolbar.value && pageSizeSelectable.value
      : pager.value.pages > 1 || props.pageSizeOptions.length > 0),
);
const cardsOn = computed(() => viewMode.value === 'cards' && cardViewEnabled.value);
/** What the column chooser marks: what the current view paints (the cards keep the low columns). */
const shownColumns = computed(() => (cardsOn.value ? visibleColumns.value : listColumns.value));
/** #171 - Rows that exist but are all hidden by the search are not an empty list. */
const noMatches = computed(() => props.rows.length > 0);
const searchHint = computed(() => props.searchPlaceholder ?? label('search'));
const template = computed(() =>
  gridTemplate({
    selectable: props.selectable,
    columns: listColumns.value,
    hasActions: hasActions.value,
    actionsTrackPx: actionsTrackPx.value,
  }),
);

// ── Watchers (what the Lit `willUpdate` did) ──────────────────────────────────────────────────
// #112 - `search` from the parent is the query the person is looking at; `undefined` = not controlled.
watch(
  () => props.search,
  (value) => {
    if (value === undefined) return;
    q.value = value;
    if (!props.serverSide) {
      clientPage.value = 0;
      mobileShown.value = 0;
    }
  },
  { immediate: true },
);
// `filters` from the parent is what the person is looking at; `undefined` = not controlled.
watch(
  () => props.filters,
  (value) => {
    if (value === undefined) return;
    filterValues.value = activeFilters(value);
    if (!props.serverSide) {
      clientPage.value = 0;
      mobileShown.value = 0;
    }
  },
  { immediate: true, deep: true },
);
watch(
  () => props.rows,
  (now, before) => {
    // #217 - New rows: every cell starts folded again.
    if (unfoldedCells.value.size) unfoldedCells.value = new Set();
    // #78/hub#2245 - A new result set starts at one page; the same records refreshed keep the window.
    if (!props.serverSide && mobileShown.value !== 0 && !sameRecords(before, now, keyOf)) mobileShown.value = 0;
  },
);

// #78 - A server window is the parent's: a phone counts from row 1 and a desk shows one page, so
// crossing the breakpoint asks for the first page again unless the window already is just that.
watch(isMobile, () => {
  if (props.serverSide && (props.page !== 0 || props.rows.length > props.pageSize)) emit('pageChange', 0);
});

// ── Selection ─────────────────────────────────────────────────────────────────────────────────
const selection = computed(() => (props.selected ? new Set(props.selected) : internalSelection.value));
const allSelected = computed(
  () => pager.value.visible.length > 0 && pager.value.visible.every((row) => selection.value.has(keyOf(row))),
);
function setSelection(next: Set<string>): void {
  if (!props.selected) internalSelection.value = next;
  emit('update:selected', [...next]);
}
function toggleRow(key: string): void {
  const next = new Set(selection.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  setSelection(next);
}
function toggleAll(): void {
  const keys = pager.value.visible.map(keyOf);
  const next = new Set(selection.value);
  if (allSelected.value) keys.forEach((k) => next.delete(k));
  else keys.forEach((k) => next.add(k));
  setSelection(next);
}

// ── Toolbar ───────────────────────────────────────────────────────────────────────────────────
function onSearch(ev: Event): void {
  const value = (ev.target as HTMLInputElement | null)?.value ?? '';
  q.value = value;
  if (!props.serverSide) {
    clientPage.value = 0;
    mobileShown.value = 0;
  }
  emit('update:search', value);
}
/** Records only what the person changed against what is painted: a column the box hid and nobody
 *  touched stays the box's to bring back (W-19). */
function onColumnsPicked(ev: CustomEvent<{ value?: unknown }>): void {
  const keys = Array.isArray(ev.detail.value) ? ev.detail.value.map(String) : [];
  const picked = new Set(keys);
  const shown = new Set(shownColumns.value.map((c) => c.key));
  const choice = new Map(columnChoice.value);
  for (const column of props.columns) {
    if (picked.has(column.key) !== shown.has(column.key)) choice.set(column.key, picked.has(column.key));
  }
  columnChoice.value = choice;
  emit('columnsChange', keys);
}
/** The list/cards ion-segment (Ioan, 2026-10-13); anything but a view is ignored. */
function onViewPicked(ev: CustomEvent<{ value?: unknown }>): void {
  const view = ev.detail.value;
  if (view !== 'table' && view !== 'cards') return;
  if (layout.setViewMode(view)) emit('viewChange', view);
}
/** #171 - «Show all»: drops the search and the column filters, so every row is back in one tap. */
function resetSearch(): void {
  q.value = '';
  clientPage.value = 0;
  mobileShown.value = 0;
  emit('update:search', '');
  clearFilters();
}

// ── Sorting ───────────────────────────────────────────────────────────────────────────────────
/** Server: opt-in (`sortable`). Client: every column unless `sortable: false`. */
const isSortable = (column: DataTableColumn<T>): boolean => (props.serverSide ? !!column.sortable : column.sortable !== false);
const isSorted = (column: DataTableColumn<T>): boolean =>
  isSortable(column) && (props.serverSide ? props.sort === column.key : clientSort.value === column.key);
function caretIcon(column: DataTableColumn<T>): string {
  if (!isSorted(column)) return ICONS.sortNone;
  const dir = props.serverSide ? props.sortDir : clientSortDir.value;
  return dir === 'asc' ? ICONS.sortAsc : ICONS.sortDesc;
}
function onHeaderClick(column: DataTableColumn<T>): void {
  if (!isSortable(column)) return;
  if (props.serverSide) {
    emit('sortChange', { sort: column.key, dir: props.sort === column.key && props.sortDir === 'asc' ? 'desc' : 'asc' });
    return;
  }
  mobileShown.value = 0; // #78 - reordering changes WHICH rows the accumulated window holds
  if (clientSort.value === column.key) clientSortDir.value = clientSortDir.value === 'asc' ? 'desc' : 'asc';
  else {
    clientSort.value = column.key;
    clientSortDir.value = 'asc';
  }
}

// ── Pager ─────────────────────────────────────────────────────────────────────────────────────
function goTo(page: number): void {
  if (props.serverSide) emit('pageChange', page);
  else clientPage.value = page;
}
function setPageSize(size: number): void {
  if (props.serverSide) {
    emit('pageSizeChange', size);
    return;
  }
  clientPageSize.value = size;
  clientPage.value = 0;
  mobileShown.value = 0;
}
function onPageSizeSelect(ev: CustomEvent<{ value?: unknown }>): void {
  setPageSize(Number(ev.detail.value));
}
function onPageSizeNative(ev: Event): void {
  setPageSize(Number((ev.target as HTMLSelectElement).value));
}
function loadMore(): void {
  if (props.serverSide) emit('loadMore');
  else mobileShown.value = Math.min((mobileShown.value || pageSizeNow.value) + pageSizeNow.value, pager.value.count);
}
const pagerFrom = computed(() => label('showing', { from: pager.value.rangeFrom, to: pager.value.rangeTo }));
const recordWord = computed(
  () => entityWord(pager.value.count, props.entityLabel) ?? label(pager.value.count === 1 ? 'recordSingular' : 'recordPlural'),
);

// ── Rows and cells ────────────────────────────────────────────────────────────────────────────
function onRowClick(row: T): void {
  if (props.rowClickable) emit('rowClick', row);
}
/** #67/#74 - Enter/Space activate a clickable row or card; Space must not scroll the page. */
function onRowKeydown(ev: KeyboardEvent, row: T): void {
  if (!props.rowClickable) return;
  if (ev.key !== 'Enter' && ev.key !== ' ' && ev.key !== 'Spacebar') return;
  ev.preventDefault();
  emit('rowClick', row);
}
const rowId = (row: T, index: number): string => keyOf(row) || `#${index}`;
/** Every row and card is hooked as `<testid>-row`, told apart by its key in `data-id` (only with a prefix). */
const rowHookId = (row: T): string | undefined => (tid('row') ? keyOf(row) : undefined);
const cellId = (row: T, column: DataTableColumn<T>): string => `${keyOf(row)}␟${column.key}`;
function notePointer(ev: PointerEvent): void {
  lastPointerType = ev.pointerType;
}
/** #217 - A touch screen has no hover for the title: in a table whose rows open nothing, a tap on a
 *  clipped cell unfolds it in place. A cell that fits, and a mouse click, change nothing. */
function onCellTap(ev: MouseEvent, id: string): void {
  if (props.rowClickable || lastPointerType !== 'touch') return;
  const span = ev.currentTarget as HTMLElement;
  if (span.scrollWidth <= span.clientWidth) return;
  unfoldedCells.value = new Set(unfoldedCells.value).add(id);
}
const alignClass = (column: DataTableColumn<T>): string | undefined =>
  column.align === 'right' ? 'data-table__cell--right' : column.align === 'center' ? 'data-table__cell--center' : undefined;

// ── Row actions ───────────────────────────────────────────────────────────────────────────────
/** #240 - Text of the invisible stand-in of a hidden text action, borrowed from a row showing it. */
const gapLabels = computed(
  () =>
    new Map(
      props.actions.map((a) => {
        if (typeof a.label !== 'function') return [a, a.label];
        const shown = props.rows.find((row) => a.hidden?.(row) !== true);
        return [a, shown ? a.label(shown) : ''];
      }),
    ),
);
interface ActionSlot {
  action: DataTableAction<T>;
  gap: boolean;
}
interface ActionCell {
  /** The buttons, in order (a `gap` is the invisible stand-in of an action hidden for the row). */
  items: ActionSlot[];
  /** What «⋮» offers for the row (nothing = no «⋮»). */
  menu: DataTableAction<T>[];
}
/** W-19 - How far the list's actions are folded right now. */
const fold = computed<RowActionsFold>(() => (rowActionsCollapsed.value ? 'all' : extraActionsFolded.value ? 'extra' : 'none'));
/** #240/W-19 - Unfolded or partly folded, every row has the same button places. */
const listSlots = computed(() => inlineActions(slotActions.value, fold.value, props.maxInlineActions));
/** What the actions cell of a list row holds. Folded entirely (#122), each row decides on its own
 *  (#213): a single icon action stays a button, as do the pinned ones. */
function listActions(row: T): ActionCell {
  const visible = visibleActions(props.actions, row);
  if (fold.value === 'all') {
    const folds = rowActionsFolded(true, visible.filter((a) => a.menuOnly !== true && a.pinned !== true));
    const inline = visible.filter((a) => a.menuOnly !== true && (a.pinned === true || !folds));
    return { items: inline.map((action) => ({ action, gap: false })), menu: visible.filter((a) => !inline.includes(a)) };
  }
  const places = listSlots.value;
  return {
    items: places.map((action) => ({ action, gap: action.hidden?.(row) === true })),
    menu: visible.filter((a) => !places.includes(a)),
  };
}
/** W-19 - Some row has a «⋮» (not folded entirely): the others keep its place with a stand-in. */
const listMenuPlace = computed(() => fold.value !== 'all' && props.rows.some((row) => listActions(row).menu.length > 0));
/** A card has room for every action: buttons, except the `menuOnly` ones, which stay in «⋮». */
function cardActions(row: T): ActionCell {
  const visible = visibleActions(props.actions, row);
  return {
    items: visible.filter((a) => a.menuOnly !== true).map((action) => ({ action, gap: false })),
    menu: visible.filter((a) => a.menuOnly === true),
  };
}
const isBusy = (action: DataTableAction<T>, row: T): boolean => action.loading?.(row) === true;
const isDisabled = (action: DataTableAction<T>, row: T): boolean => isBusy(action, row) || action.disabled?.(row) === true;
function runAction(action: DataTableAction<T>, row: T): void {
  emit('action', { actionId: action.id, row });
}

/** #122 - The row the «…» menu is open for, read again by key (its data may have changed). */
const menuRow = computed(() => {
  const kept = rowMenuRow.value;
  if (!kept) return undefined;
  const key = keyOf(kept);
  return (key ? props.rows.find((row) => keyOf(row) === key) : undefined) ?? kept;
});
/** #143 - What «⋮» offers now: never an action that has its button on screen, so a menu item can
 *  carry the action's hook without it ever being there twice. */
const menuActions = computed(() => {
  const row = menuRow.value;
  if (!row) return [];
  return (cardsOn.value ? cardActions(row) : listActions(row)).menu;
});
// The box widened under an open menu and every action is a button again: nothing left to offer.
watch(
  () => menuActions.value.length,
  (count) => {
    if (count === 0) rowMenuOpen.value = false;
  },
);
function openRowMenu(ev: Event, row: T): void {
  ev.stopPropagation();
  rowMenuEvent.value = ev;
  rowMenuRow.value = row;
  rowMenuOpen.value = true;
}
function pickMenuAction(action: DataTableAction<T>): void {
  const row = menuRow.value;
  if (!row || isDisabled(action, row)) return;
  rowMenuOpen.value = false;
  runAction(action, row);
}

// ── Cards ─────────────────────────────────────────────────────────────────────────────────────
/** The column `cardTitleColumn` names, when it is one of the table's. */
const namedTitleColumn = computed(() =>
  props.cardTitleColumn ? props.columns.find((c) => c.key === props.cardTitleColumn) : undefined,
);
const hasCardHead = computed(() => !!props.cardTitle || !!namedTitleColumn.value || !!props.cardIcon || props.selectable);
/** The card title: `cardTitle`, else the painted text of the named column. */
function cardTitleOf(row: T): string | number {
  if (props.cardTitle) return props.cardTitle(row) ?? '';
  return namedTitleColumn.value ? cellText(namedTitleColumn.value, row) : '';
}
/** #205 - The default card body leaves out the column the title already shows: the one
 *  `cardTitleColumn` names, else the one whose text is the title. */
function cardFields(row: T): DataTableColumn<T>[] {
  const named = namedTitleColumn.value;
  if (named) return visibleColumns.value.filter((c) => c !== named);
  const titleColumn = props.cardTitle ? titleColumnByText(props.cardTitle(row), row, visibleColumns.value) : undefined;
  return visibleColumns.value.filter((c) => c !== titleColumn);
}

// #182 - The search box is named after its hint, after every render.
function nameSearchBox(): void {
  syncSearchbarInputName(root.value?.querySelector(':scope > .data-table__surface > .data-table__bar') ?? null, () => searchHint.value);
}
onMounted(nameSearchBox);
onUpdated(nameSearchBox);
</script>

<template>
  <div
    ref="root"
    :class="['data-table', { 'data-table--fill': fill, 'data-table--content-after': contentAfter }]"
  >
    <div
      class="data-table__surface"
      :aria-busy="loading ? 'true' : undefined"
    >
      <div
        v-if="showTopbar"
        class="data-table__bar"
      >
        <div class="data-table__bar-main">
          <div
            v-if="title"
            class="data-table__title-wrap"
          >
            <h2 class="data-table__title">
              {{ title }}
            </h2>
            <span
              v-if="!loadFailed && !awaitingRows"
              class="data-table__title-count"
            >{{ pager.count }}</span>
          </div>
          <div
            v-if="hasSearch"
            class="data-table__search"
          >
            <ion-searchbar
              class="ion-no-border"
              :data-testid="tid('search')"
              :value="q"
              :placeholder="searchHint"
              :debounce="250"
              @ion-input="onSearch"
            />
          </div>
          <slot name="filters" />
          <span class="data-table__spacer" />
          <ion-select
            v-if="columnPicker && !isMobile"
            class="data-table__columns-select"
            :multiple="true"
            interface="popover"
            :aria-label="label('columnsVisible')"
            :value="shownColumns.map((c) => c.key)"
            :selected-text="label('columns')"
            @ion-change="onColumnsPicked"
          >
            <ion-select-option
              v-for="column in columns"
              :key="column.key"
              :value="column.key"
            >
              {{ column.label }}
            </ion-select-option>
          </ion-select>
          <ion-select
            v-if="pageSizeSelectable && !isMobile"
            class="data-table__page-size-select"
            interface="popover"
            :aria-label="label('rowsPerPage')"
            :value="pageSizeNow"
            @ion-change="onPageSizeSelect"
          >
            <ion-select-option
              v-for="size in pageSizeOptions"
              :key="size"
              :value="size"
            >
              {{ size }}
            </ion-select-option>
          </ion-select>
          <!-- Ioan, 2026-10-13: the list/cards switch is Ionic's segment (it marks the checked one). -->
          <ion-segment
            v-if="viewToggle"
            class="data-table__view-segment"
            :data-testid="tid('view')"
            :value="viewMode"
            @ion-change="onViewPicked"
          >
            <ion-segment-button
              value="table"
              :data-testid="tid('view-table')"
              :title="label('viewList')"
              :aria-label="label('viewList')"
            >
              <ion-icon
                :icon="icon(ICONS.list)"
                aria-hidden="true"
              />
            </ion-segment-button>
            <ion-segment-button
              value="cards"
              :data-testid="tid('view-cards')"
              :title="label('viewCards')"
              :aria-label="label('viewCards')"
            >
              <ion-icon
                :icon="icon(ICONS.cards)"
                aria-hidden="true"
              />
            </ion-segment-button>
          </ion-segment>
          <!-- #113/#216 - The main action of the screen is read, not guessed: labelled, both viewports. -->
          <ion-button
            v-if="addable"
            class="data-table__primary-button data-table__add-button"
            :data-testid="tid('add')"
            size="small"
            @click="emit('add')"
          >
            <ion-icon
              slot="start"
              :icon="icon(ICONS.add)"
            />{{ label('add') }}
          </ion-button>
          <ion-button
            v-if="primaryAction"
            class="data-table__primary-button data-table__add-button"
            :data-testid="tid('primary-action')"
            size="small"
            @click="emit('primaryAction')"
          >
            <ion-icon
              slot="start"
              :icon="icon(primaryAction.icon ?? ICONS.add)"
            />{{ primaryAction.label }}
          </ion-button>
          <slot name="toolbar" />
        </div>
        <!-- Column filters: one control per filtered column, in column order. -->
        <div
          v-if="filterColumns.length"
          class="data-table__filters"
          role="group"
          :aria-label="label('filters')"
          :data-testid="tid('filters')"
        >
          <template
            v-for="column in filterColumns"
            :key="column.key"
          >
            <!-- Unfiltered, «All» ('') is checked and the select reads as its column («Status»). -->
            <ion-select
              v-if="column.filter?.type === 'select'"
              class="data-table__filter"
              interface="popover"
              :aria-label="column.label"
              :placeholder="column.label"
              :value="filterValues[filterName(column)] ?? ''"
              :selected-text="filterValues[filterName(column)] ? undefined : column.label"
              :data-testid="tid(`filter-${filterName(column)}`)"
              @ion-change="onFilter(filterName(column), $event)"
            >
              <ion-select-option value="">
                {{ label('filterAll') }}
              </ion-select-option>
              <ion-select-option
                v-for="option in column.filter.options ?? []"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </ion-select-option>
            </ion-select>
            <span
              v-else-if="column.filter?.type === 'range'"
              class="data-table__filter-range"
              role="group"
              :aria-label="column.label"
            >
              <ion-input
                v-for="{ name, hint, named } in rangeEnds(column)"
                :key="name"
                class="data-table__filter"
                type="number"
                inputmode="decimal"
                :debounce="250"
                :aria-label="named"
                :placeholder="hint"
                :value="filterValues[name] ?? ''"
                :data-testid="tid(`filter-${name}`)"
                @ion-input="onFilter(name, $event)"
              />
            </span>
            <ion-input
              v-else-if="column.filter?.type === 'date'"
              class="data-table__filter"
              type="date"
              :aria-label="column.label"
              :value="filterValues[filterName(column)] ?? ''"
              :data-testid="tid(`filter-${filterName(column)}`)"
              @ion-change="onFilter(filterName(column), $event)"
            />
            <ion-input
              v-else
              class="data-table__filter"
              type="text"
              :clear-input="true"
              :debounce="250"
              :aria-label="column.label"
              :placeholder="column.label"
              :value="filterValues[filterName(column)] ?? ''"
              :data-testid="tid(`filter-${filterName(column)}`)"
              @ion-input="onFilter(filterName(column), $event)"
            />
          </template>
          <ion-chip
            v-if="filtering"
            class="data-table__filters-clear"
            role="button"
            tabindex="0"
            :data-testid="tid('filters-clear')"
            @click="clearFilters"
            @keydown.enter.prevent="clearFilters"
            @keydown.space.prevent="clearFilters"
          >
            <ion-label>{{ label('clearFilters') }}</ion-label>
            <ion-icon
              :icon="icon(ICONS.clearFilters)"
              aria-hidden="true"
            />
          </ion-chip>
        </div>
        <div
          v-if="selectable && selection.size > 0"
          class="data-table__selection-bar"
        >
          <strong>{{ label('selected', { n: selection.size }) }}</strong>
          <button
            type="button"
            class="data-table__selection-clear"
            @click="setSelection(new Set())"
          >
            <ion-icon
              :icon="icon(ICONS.clear)"
              style="font-size: 14px"
            />{{ ` ${label('clear')}` }}
          </button>
        </div>
      </div>

      <!-- #268 - The first rows are on their way: not «empty», not «0 records». -->
      <div
        v-if="awaitingRows"
        class="data-table__loading"
        role="status"
        data-role="loading"
        :data-testid="tid('loading')"
      >
        <ion-spinner
          name="crescent"
          aria-hidden="true"
        />
        <span>{{ label('loading') }}</span>
      </div>

      <!-- pm#530 - The load failed: says so, gives the reason, offers to retry. -->
      <div
        v-else-if="loadFailed"
        class="data-table__error"
        role="alert"
        data-role="load-error"
      >
        <span class="data-table__state-icon"><ion-icon :icon="icon(ICONS.error)" /></span>
        <strong class="data-table__error-title">{{ label('loadError') }}</strong>
        <span class="data-table__error-reason">{{ error }}</span>
        <ion-button
          size="small"
          data-role="load-error-retry"
          :data-testid="tid('retry')"
          @click="emit('retry')"
        >
          {{ label('retry') }}
        </ion-button>
      </div>

      <div
        v-else-if="pager.visible.length === 0"
        class="data-table__empty"
      >
        <slot name="empty">
          <span class="data-table__state-icon"><ion-icon :icon="icon(ICONS.empty)" /></span>
          <span>{{ noMatches ? (noMatchesMessage ?? label('noMatches')) : (emptyMessage ?? label('empty')) }}</span>
          <ion-button
            v-if="noMatches"
            fill="clear"
            size="small"
            data-role="no-matches-reset"
            :data-testid="tid('show-all')"
            @click="resetSearch"
          >
            {{ label('showAll') }}
          </ion-button>
        </slot>
      </div>

      <!-- Cards: an Ionic card per row; the view a phone gets when cards are declared (#274). -->
      <div
        v-else-if="cardsOn"
        class="data-table__cards"
      >
        <ion-card
          v-for="(row, index) in pager.visible"
          :key="rowId(row, index)"
          :class="[
            'data-table__card',
            {
              'data-table__card--selected': selectable && selection.has(keyOf(row)),
              'data-table__card--clickable': rowClickable,
            },
          ]"
          :data-testid="tid('row')"
          :data-id="rowHookId(row)"
          :role="rowClickable ? 'button' : undefined"
          :tabindex="rowClickable ? 0 : undefined"
          @click="onRowClick(row)"
          @keydown="onRowKeydown($event, row)"
        >
          <ion-card-header
            v-if="hasCardHead"
            class="data-table__card-head"
          >
            <span
              v-if="cardIcon?.(row)"
              class="data-table__card-icon"
            ><ion-icon :icon="icon(cardIcon(row))" /></span>
            <span class="data-table__card-title">{{ cardTitleOf(row) }}</span>
            <ion-checkbox
              v-if="selectable"
              :checked="selection.has(keyOf(row))"
              :aria-label="label('select')"
              @click.stop
              @ion-change="toggleRow(keyOf(row))"
            />
          </ion-card-header>
          <ion-card-content class="data-table__card-body">
            <slot
              v-if="slots.card"
              name="card"
              :row="row"
            />
            <template v-else>
              <div
                v-for="column in cardFields(row)"
                :key="column.key"
                class="data-table__field"
              >
                <span class="data-table__field-label">{{ column.label }}</span>
                <span class="data-table__field-value">
                  <slot
                    v-if="column.cell"
                    :name="column.cell"
                    :row="row"
                    :value="fieldOf(row, column.key)"
                    :column="column"
                  />
                  <template v-else>{{ cellText(column, row) }}</template>
                </span>
              </div>
            </template>
          </ion-card-content>
          <div
            v-if="hasActions"
            class="data-table__card-actions"
            @click.stop
          >
            <div class="data-table__actions">
              <ion-button
                v-for="{ action } in cardActions(row).items"
                :key="action.id"
                :class="{ 'data-table__action--labelled': iconWithLabel(action) }"
                size="small"
                fill="clear"
                :style="toneStyle(action.color ?? 'medium', 'clear')"
                :data-testid="tid(`row-${keyOf(row)}-${action.id}`)"
                :disabled="isDisabled(action, row)"
                :aria-disabled="isDisabled(action, row) ? 'true' : undefined"
                :aria-label="actionLabel(action, row)"
                :title="actionLabel(action, row)"
                @click="runAction(action, row)"
              >
                <ion-spinner
                  v-if="isBusy(action, row) && iconWithLabel(action)"
                  slot="start"
                  name="dots"
                />
                <ion-spinner
                  v-else-if="isBusy(action, row)"
                  slot="icon-only"
                  name="dots"
                />
                <ion-icon
                  v-else-if="iconWithLabel(action)"
                  slot="start"
                  :icon="icon(action.icon)"
                />
                <ion-icon
                  v-else-if="action.icon"
                  slot="icon-only"
                  :icon="icon(action.icon)"
                />
                <template v-if="iconWithLabel(action) || (!action.icon && !isBusy(action, row))">
                  {{ actionLabel(action, row) }}
                </template>
              </ion-button>
              <slot
                name="row-actions"
                :row="row"
              />
              <!-- W-19 - The `menuOnly` actions never get a button, not even on a card. -->
              <ion-button
                v-if="cardActions(row).menu.length"
                size="small"
                fill="clear"
                :style="toneStyle('medium', 'clear')"
                :data-testid="tid(`row-${keyOf(row)}-menu`)"
                :aria-label="label('moreActions')"
                :title="label('moreActions')"
                aria-haspopup="menu"
                @click="openRowMenu($event, row)"
              >
                <ion-icon
                  slot="icon-only"
                  :icon="icon(ICONS.more)"
                />
              </ion-button>
            </div>
          </div>
        </ion-card>
      </div>

      <!-- The list, in CSS grid (not <table>): width per column and a sticky header. -->
      <template v-else>
        <div :class="['data-table__scroll', { 'data-table__scroll--overflow': xOverflow }]">
          <div
            class="data-table__grid"
            role="table"
          >
            <div
              class="data-table__row data-table__row--head"
              role="row"
              :style="{ gridTemplateColumns: template }"
            >
              <span
                v-if="selectable"
                class="data-table__select-cell"
              >
                <ion-checkbox
                  :checked="allSelected"
                  :aria-label="label('selectAll')"
                  @ion-change="toggleAll"
                />
              </span>
              <div
                v-for="column in listColumns"
                :key="column.key"
                :class="[
                  'data-table__cell data-table__cell--header',
                  alignClass(column),
                  {
                    'data-table__cell--sortable': isSortable(column),
                    'data-table__cell--pinned': column.pinned === 'end',
                  },
                ]"
                role="columnheader"
                @click="onHeaderClick(column)"
              >
                <span :title="column.label || undefined">{{ column.label }}</span>
                <span
                  v-if="isSortable(column)"
                  :class="['data-table__caret', { 'data-table__caret--active': isSorted(column) }]"
                ><ion-icon :icon="icon(caretIcon(column))" /></span>
              </div>
              <div
                v-if="hasActions"
                class="data-table__cell data-table__cell--header data-table__cell--right data-table__cell--pinned data-table__cell--actions"
                role="columnheader"
              >
                <!-- #122/#211 - Named for assistive tech, not painted, when it would not fit. -->
                <span :class="{ 'data-table__sr-only': rowActionsCollapsed || !actionsLabelFits }">{{ label('actions') }}</span>
              </div>
            </div>

            <div
              v-for="(row, index) in pager.visible"
              :key="rowId(row, index)"
              :class="[
                'data-table__row data-table__row--data',
                {
                  'data-table__row--selected': selectable && selection.has(keyOf(row)),
                  'data-table__row--clickable': rowClickable,
                },
              ]"
              role="row"
              :data-testid="tid('row')"
              :data-id="rowHookId(row)"
              :style="{ gridTemplateColumns: template }"
              :tabindex="rowClickable ? 0 : undefined"
              @click="onRowClick(row)"
              @keydown="onRowKeydown($event, row)"
            >
              <span
                v-if="selectable"
                class="data-table__select-cell"
                @click.stop
              >
                <ion-checkbox
                  :checked="selection.has(keyOf(row))"
                  :aria-label="label('selectRow')"
                  @ion-change="toggleRow(keyOf(row))"
                />
              </span>
              <div
                v-for="column in listColumns"
                :key="column.key"
                :class="['data-table__cell', alignClass(column), { 'data-table__cell--pinned': column.pinned === 'end' }]"
                role="cell"
              >
                <slot
                  v-if="column.cell"
                  :name="column.cell"
                  :row="row"
                  :value="fieldOf(row, column.key)"
                  :column="column"
                />
                <span
                  v-else
                  :class="['data-table__text', { 'data-table__text--unfolded': unfoldedCells.has(cellId(row, column)) }]"
                  :title="cellText(column, row) || undefined"
                  @pointerdown="notePointer"
                  @click="onCellTap($event, cellId(row, column))"
                >{{ cellText(column, row) }}</span>
              </div>
              <div
                v-if="hasActions"
                class="data-table__cell data-table__cell--right data-table__cell--pinned data-table__cell--actions"
                role="cell"
                @click.stop
              >
                <div class="data-table__actions">
                  <template
                    v-for="{ action, gap } in listActions(row).items"
                    :key="action.id"
                  >
                    <!-- #240 - A hidden action keeps its width, invisible and inert: the others stay in their column. -->
                    <ion-button
                      v-if="gap"
                      :class="['data-table__action-gap', { 'data-table__action--labelled': iconWithLabel(action) }]"
                      size="small"
                      fill="clear"
                      :data-slot-for="action.id"
                      aria-hidden="true"
                      inert
                    >
                      <ion-icon
                        v-if="iconWithLabel(action)"
                        slot="start"
                        :icon="icon(action.icon)"
                      />
                      <ion-icon
                        v-else-if="action.icon"
                        slot="icon-only"
                        :icon="icon(action.icon)"
                      />
                      <template v-if="!action.icon || iconWithLabel(action)">
                        {{ gapLabels.get(action) }}
                      </template>
                    </ion-button>
                    <ion-button
                      v-else
                      :class="{ 'data-table__action--labelled': iconWithLabel(action) }"
                      size="small"
                      fill="clear"
                      :style="toneStyle(action.color ?? 'medium', 'clear')"
                      :data-testid="tid(`row-${keyOf(row)}-${action.id}`)"
                      :disabled="isDisabled(action, row)"
                      :aria-disabled="isDisabled(action, row) ? 'true' : undefined"
                      :aria-label="actionLabel(action, row)"
                      :title="actionLabel(action, row)"
                      @click="runAction(action, row)"
                    >
                      <ion-spinner
                        v-if="isBusy(action, row) && iconWithLabel(action)"
                        slot="start"
                        name="dots"
                      />
                      <ion-spinner
                        v-else-if="isBusy(action, row)"
                        slot="icon-only"
                        name="dots"
                      />
                      <ion-icon
                        v-else-if="iconWithLabel(action)"
                        slot="start"
                        :icon="icon(action.icon)"
                      />
                      <ion-icon
                        v-else-if="action.icon"
                        slot="icon-only"
                        :icon="icon(action.icon)"
                      />
                      <template v-if="iconWithLabel(action) || (!action.icon && !isBusy(action, row))">
                        {{ actionLabel(action, row) }}
                      </template>
                    </ion-button>
                  </template>
                  <slot
                    name="row-actions"
                    :row="row"
                  />
                  <!-- #122/W-19 - «⋮»: one button that opens what left the row (folded, or menuOnly). -->
                  <ion-button
                    v-if="listActions(row).menu.length"
                    size="small"
                    fill="clear"
                    :style="toneStyle('medium', 'clear')"
                    :data-testid="tid(`row-${keyOf(row)}-menu`)"
                    :aria-label="label('moreActions')"
                    :title="label('moreActions')"
                    aria-haspopup="menu"
                    @click="openRowMenu($event, row)"
                  >
                    <ion-icon
                      slot="icon-only"
                      :icon="icon(ICONS.more)"
                    />
                  </ion-button>
                  <!-- #240/W-19 - Another row has «⋮»: its place, invisible and inert. -->
                  <ion-button
                    v-else-if="listMenuPlace"
                    class="data-table__action-gap"
                    size="small"
                    fill="clear"
                    data-slot-for="menu"
                    aria-hidden="true"
                    inert
                  >
                    <ion-icon
                      slot="icon-only"
                      :icon="icon(ICONS.more)"
                    />
                  </ion-button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- The row's «⋮» menu, for the list and the cards (Ionic presents it out of the table). -->
      <ion-popover
        v-if="actions.length && menuRow"
        class="data-table__row-menu"
        :is-open="rowMenuOpen"
        :event="rowMenuEvent"
        :dismiss-on-select="true"
        @did-dismiss="rowMenuOpen = false"
      >
        <ion-content>
          <ion-list lines="none">
            <ion-item
              v-for="action in menuActions"
              :key="action.id"
              :button="true"
              :detail="false"
              :data-testid="tid(`row-${keyOf(menuRow)}-${action.id}`)"
              :disabled="isDisabled(action, menuRow)"
              :aria-disabled="isDisabled(action, menuRow) ? 'true' : undefined"
              @click="pickMenuAction(action)"
            >
              <ion-icon
                v-if="action.icon"
                slot="start"
                :icon="icon(action.icon)"
                :style="toneStyle(action.color, 'text')"
              />
              <ion-label :style="toneStyle(action.color, 'text')">
                {{ actionLabel(action, menuRow) }}
              </ion-label>
            </ion-item>
          </ion-list>
        </ion-content>
      </ion-popover>

      <div
        v-if="showPager"
        class="data-table__pager"
      >
        <div class="data-table__pager-info">
          <span>
            <template v-if="pager.pages > 1 && !awaitingRows">{{ `${pagerFrom} ` }}</template>
            <template v-if="!awaitingRows"><span class="data-table__pager-count">{{ pager.count }}</span>{{ ` ${recordWord}` }}</template>
          </span>
          <select
            v-if="!hasToolbar && pageSizeSelectable"
            class="data-table__pager-size"
            @change="onPageSizeNative"
          >
            <option
              v-for="size in pageSizeOptions"
              :key="size"
              :value="size"
              :selected="size === pageSizeNow"
            >
              {{ label('perPageShort', { n: size }) }}
            </option>
          </select>
        </div>
        <!-- #78 - On a phone one «Load more» instead of page buttons. -->
        <template v-if="isMobile">
          <ion-button
            v-if="pager.canLoadMore && !awaitingRows"
            class="data-table__load-more"
            :data-testid="tid('load-more')"
            size="small"
            @click="loadMore"
          >
            {{ label('loadMore') }}
          </ion-button>
        </template>
        <div
          v-else-if="pager.pages > 1 && !awaitingRows"
          class="data-table__pager-nav"
        >
          <ion-button
            size="small"
            fill="clear"
            :data-testid="tid('page-prev')"
            :disabled="pager.current === 0"
            @click="goTo(pager.current - 1)"
          >
            <ion-icon
              slot="icon-only"
              :icon="icon(ICONS.previous)"
            />
          </ion-button>
          <template
            v-for="(entry, index) in pageList(pager.current + 1, pager.pages)"
            :key="`${entry}-${index}`"
          >
            <span
              v-if="entry === '…'"
              class="data-table__page-gap"
            >…</span>
            <button
              v-else
              type="button"
              :class="['data-table__page', { 'data-table__page--current': entry === pager.current + 1 }]"
              @click="goTo(entry - 1)"
            >
              {{ entry }}
            </button>
          </template>
          <ion-button
            size="small"
            fill="clear"
            :data-testid="tid('page-next')"
            :disabled="pager.current >= pager.pages - 1"
            @click="goTo(pager.current + 1)"
          >
            <ion-icon
              slot="icon-only"
              :icon="icon(ICONS.next)"
            />
          </ion-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Port of the `static styles` of OutfitKit's ok-data-table: same rules, same values; `:host` is
   `.data-table`, classes are `data-table__*`, and the --ok-* tokens are the --ion-* they mirrored
   (or our --ep-*, variables.css). Issue numbers are ERPlora/outfitkit's. */

/* ── Shell shield ──────────────────────────────────────────────────────────────────────────────
   The Lit table lived in a shadow root, out of reach of the document's CSS. In light DOM a document
   rule beats any `:host` rule of an Ionic component, even Tailwind's layered preflight
   (`* { margin: 0; padding: 0 }`), and the shell's polish.css restyles ion-button/ion-card. So the
   table's OWN controls (scoped: slot content is the page's) get back what the shadow root painted,
   measured against the Lit table in Chromium: Ionic's ios (ADR-0143) host values, and the
   `--border-radius` an ion-select inherits from the table. `:where()` keeps them at the lowest
   specificity that still beats those rules, so every ported rule below wins over them. */
:where(.data-table) ion-button { height: auto; margin: 4px 2px; text-transform: inherit; font-weight: 500; --border-radius: 6px; }
:where(.data-table) ion-button[fill="clear"] { font-weight: normal; --color: var(--ion-color-primary, #0054e9); }
/* Ionic's `::slotted(ion-icon[slot=start])` pull; the end margin is the ported `0.35rem` below. */
:where(.data-table) ion-button > ion-icon[slot="start"] { margin-inline-start: -0.3em; }
:where(.data-table) ion-select { --border-radius: inherit; }
:where(.data-table) ion-card { border: initial; border-radius: 8px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12); }
:where(.data-table) ion-card-header { padding: 20px 20px 16px; }

/* The Lit `:host`. The frame (shadow, clip) is the one the shell's polish.css gave ok-data-table;
   its `--ok-radius: var(--ok-radius)` was a cycle, so the host painted no radius and the card fell
   back to 16px (measured in Chromium) — kept as painted. */
.data-table {
  --background: var(--ion-card-background, var(--ion-background-color, #ffffff));
  --color: var(--ion-text-color, #1c1b17);
  --color-muted: var(--ion-color-medium, rgba(var(--ion-text-color-rgb, 24, 24, 27), 0.55));
  --border-color: var(--ion-color-step-150, rgba(var(--ion-text-color-rgb, 24, 24, 27), 0.12));
  --border-color-soft: var(--ion-color-step-100, rgba(var(--ion-text-color-rgb, 24, 24, 27), 0.07));
  /* Toolbar controls (selects) need a marked border to read as controls in light and dark. */
  --control-border: color-mix(in srgb, var(--color) 22%, transparent);
  --header-background: var(--ion-color-step-100, rgba(var(--ion-text-color-rgb, 24, 24, 27), 0.04));
  --row-hover: var(--ion-color-step-50, rgba(var(--ion-text-color-rgb, 24, 24, 27), 0.03));
  --primary: var(--ion-color-primary, #3880ff);
  --primary-contrast: var(--ion-color-primary-contrast, #ffffff);
  --border-radius: 16px;
  --font: var(--ion-font-family, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif);

  display: block;
  color: var(--color);
  font-family: var(--font);
  box-shadow: var(--ep-shadow-sm);
  overflow: hidden;
}
* { box-sizing: border-box; }
/* The shell's global `*` asks for thin scrollbars; inside the shadow root they stayed auto. */
.data-table :deep(*) { scrollbar-width: auto; }
.data-table__surface {
  position: relative;
  display: flex;
  flex-direction: column;
  /* Flat: no border nor elevation. */
  border: 0;
  border-radius: var(--border-radius);
  overflow: hidden;
  background: var(--background);
  box-shadow: none;
}

/* `fill`: the table takes the container's height; rows scroll inside; the pager stays. */
.data-table--fill { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.data-table--fill .data-table__surface { flex: 1 1 auto; min-height: 0; }
.data-table--fill .data-table__bar, .data-table--fill .data-table__pager { flex: 0 0 auto; }
.data-table--fill .data-table__scroll, .data-table--fill .data-table__cards { flex: 1 1 auto; min-height: 0; overflow: auto; }
/* Without rows only a state block is painted: it fills the gap between toolbar and pager. */
.data-table--fill .data-table__empty, .data-table--fill .data-table__error, .data-table--fill .data-table__loading { flex: 1 1 auto; min-height: 0; }
/* #218 - On a phone the list scrolls WITH the page; the box only grows when content follows it. */
@media (max-width: 640px) {
  .data-table--fill .data-table__surface { flex: 1 0 auto; }
  .data-table--fill .data-table__scroll, .data-table--fill .data-table__cards { flex: 0 0 auto; }
  .data-table--fill .data-table__cards { overflow: visible; }
  .data-table--fill.data-table--content-after { height: auto; flex-shrink: 0 !important; }
  /* With nothing after it, too: at the container's height (`overflow: hidden`) it clipped its rows
     and its pager, and the page had nothing to scroll (measured at 390px in AppPage detail-fill). */
  .data-table--fill:not(.data-table--content-after) { height: auto; min-height: 100%; }
}

/* ── Toolbar ─────────────────────────────────────────────────────────────────────────────── */
.data-table__bar { display: flex; flex-direction: column; gap: 0.6rem; padding: 0.65rem 1rem; border-bottom: 1px solid var(--border-color); background: var(--header-background); }
/* ONE flex row that wraps item by item; the spacer pushes the right cluster to the edge. */
.data-table__bar-main { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
.data-table__bar-main > ion-button { --padding-start: 0.5rem; --padding-end: 0.5rem; margin: 0; }
.data-table__spacer { flex: 1 1 0; min-width: 0; align-self: stretch; }
@media (max-width: 1024px) { .data-table__spacer { display: none; } }
/* The search box takes its own line on a phone. */
@media (max-width: 640px) { .data-table__search { flex-basis: 100%; max-width: none; } }
.data-table__title-wrap { display: flex; align-items: baseline; gap: 0.5rem; }
.data-table__title { font-size: 15px; font-weight: 600; line-height: 1; margin: 0; letter-spacing: inherit; }
.data-table__title-count { font-size: 12px; font-weight: 500; color: var(--color-muted); }

/* Search box: does not grow (the spacer takes the gap); shrinks to its minimum, then wraps. Its
   ion-searchbar rules live in the unscoped block below. */
.data-table__search { flex: 0 1 22rem; min-width: 12rem; max-width: 24rem; }
/* #237 - One clear cross: Chromium's native cancel button of `type=search` hidden. Alone in its rule. */
.data-table__search :deep(input::-webkit-search-cancel-button) { -webkit-appearance: none; appearance: none; display: none; }

/* List/cards switch: Ionic's segment (Ioan, 2026-10-13). An ion-segment is 100% wide by default:
   here it takes only its buttons; icon-only buttons as tall as the toolbar controls. */
.data-table__view-segment { flex: 0 0 auto; width: auto; }
.data-table__view-segment ion-segment-button { min-width: 44px; min-height: 36px; }

/* Primary button. #113 - the create action is labelled and filled, 36px to line up with the bar
   (44px back on coarse pointers, below). */
.data-table__primary-button { --background: var(--primary); --color: var(--primary-contrast); }
.data-table__add-button { min-height: 36px; --border-radius: 10px; --padding-start: 0.9rem; --padding-end: 1rem; margin: 0; font-weight: 600; }
.data-table__add-button ion-icon { margin-inline-end: 0.35rem; }

/* Toolbar selects: visible background and border, like the search box. */
.data-table__columns-select { min-width: 6.5rem; max-width: 9rem; min-height: 38px; font-size: 13px; background: var(--background); color: var(--color); border: 1px solid var(--control-border); border-radius: 10px; --padding-start: 0.6rem; --padding-end: 0.4rem; --padding-top: 0.3rem; --padding-bottom: 0.3rem; }
.data-table__page-size-select { min-width: 4.25rem; max-width: 5.5rem; min-height: 38px; font-size: 13px; background: var(--background); color: var(--color); border: 1px solid var(--control-border); border-radius: 10px; --padding-start: 0.6rem; --padding-end: 0.4rem; --padding-top: 0.35rem; --padding-bottom: 0.35rem; }
/* A select the page adds in the `filters` (or `toolbar`) slot: boxed like the two above. */
.data-table__bar-main > :slotted(ion-select) { min-width: 6.5rem; max-width: 8rem; min-height: 38px; font-size: 13px; background: var(--background); color: var(--color); border: 1px solid var(--control-border); border-radius: 10px; --padding-start: 0.6rem; --padding-end: 0.4rem; --padding-top: 0.3rem; --padding-bottom: 0.3rem; }

/* Selection bar. */
/* Column filters: a row of boxed controls under the toolbar's main row (the Lit inline filters). */
.data-table__filters { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
.data-table__filter { min-width: 8.5rem; max-width: 13rem; min-height: 38px; font-size: 13px; background: var(--background); color: var(--color); border: 1px solid var(--control-border); border-radius: 10px; --padding-start: 0.7rem; --padding-end: 0.5rem; --padding-top: 0.35rem; --padding-bottom: 0.35rem; }
.data-table__filter-range { display: inline-flex; align-items: center; gap: 0.35rem; }
.data-table__filter-range .data-table__filter { min-width: 5.5rem; max-width: 7rem; }
.data-table__filters-clear { margin: 0; font-size: 13px; }
.data-table__selection-bar { display: flex; align-items: center; gap: 0.6rem; padding: 0.4rem 0.7rem; border-radius: 10px; font-size: 13px; color: var(--primary); background: color-mix(in srgb, var(--primary) 12%, transparent); }
/* `padding: revert`: the browser's own button padding, which normalize.css would zero. */
.data-table__selection-clear { margin-left: auto; display: inline-flex; align-items: center; gap: 0.25rem; cursor: pointer; font-weight: 500; color: inherit; background: none; border: 0; font: inherit; padding: revert; }
.data-table__selection-clear:hover { text-decoration: underline; }

/* ── The list, in CSS grid ───────────────────────────────────────────────────────────────── */
/* #67 - A permanent horizontal scrollbar when it overflows (the macOS overlay hides itself). */
.data-table__scroll { overflow-x: auto; }
.data-table__scroll::-webkit-scrollbar { height: 10px; }
.data-table__scroll::-webkit-scrollbar-track { background: transparent; }
.data-table__scroll::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--color) 25%, transparent); border-radius: 6px; }
.data-table__scroll::-webkit-scrollbar-thumb:hover { background: color-mix(in srgb, var(--color) 40%, transparent); }
/* #120 - The grid floor is the SUM of the column minimums (min-content), not its maximum. */
.data-table__grid { min-width: min-content; font-size: 14px; }
.data-table__row { display: grid; align-items: center; gap: 0.5rem; padding: 0 1rem; }
.data-table__row--head { position: sticky; top: 0; z-index: 2; border-bottom: 1px solid var(--border-color); background: var(--header-background); padding-top: 0.55rem; padding-bottom: 0.55rem; }
.data-table__cell { display: flex; align-items: center; min-width: 0; }
/* `:deep`: a span a cell slot paints is clipped too, as a `render` span was in the shadow root. */
.data-table__cell > :deep(span) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* #217 - A tapped clipped cell unfolds in place; the rest of the row keeps its one line. */
.data-table__cell > .data-table__text--unfolded { white-space: normal; overflow-wrap: anywhere; }
.data-table__cell--right { justify-content: flex-end; text-align: right; }
.data-table__cell--center { justify-content: center; text-align: center; }
/* #67 - PINNED column (row actions, `pinned: 'end'`): stuck to the right edge, on the row background. */
.data-table__cell--pinned { position: sticky; right: 0; z-index: 1; background: inherit; margin-right: -1rem; padding-right: 1rem; }
/* The shadow only when something is really hidden to the left. */
.data-table__scroll--overflow .data-table__cell--pinned { box-shadow: -10px 0 10px -10px color-mix(in srgb, var(--color) 45%, transparent); }
/* #120 - The pinned header is OPAQUE: the tint laid over the table background. */
.data-table__row--head .data-table__cell--pinned { z-index: 3; background: linear-gradient(var(--header-background), var(--header-background)), var(--background); }
.data-table__cell--header { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted); }
.data-table__cell--sortable { cursor: pointer; user-select: none; white-space: nowrap; transition: background-color var(--ep-transition, 150ms ease), color var(--ep-transition, 150ms ease), box-shadow var(--ep-transition, 150ms ease), transform 120ms ease; }
@media (hover: hover) {
  .data-table__cell--sortable:hover { color: var(--color); }
}
/* Sort caret (3 states): neutral dimmed / active in primary. */
.data-table__caret { display: inline-flex; align-items: center; margin-left: 0.25rem; flex: 0 0 auto; font-size: 13px; opacity: 0.3; }
.data-table__caret--active { opacity: 1; color: var(--primary); }
.data-table__row--data { background: var(--background); border-bottom: 1px solid var(--border-color-soft); padding-top: 0.6rem; padding-bottom: 0.6rem; transition: background-color var(--ep-transition, 150ms ease), color var(--ep-transition, 150ms ease), box-shadow var(--ep-transition, 150ms ease), transform 120ms ease; }
.data-table__row--data:last-child { border-bottom: 0; }
@media (hover: hover) {
  .data-table__row--data:hover { background: linear-gradient(var(--row-hover), var(--row-hover)), var(--background); }
}
.data-table__row--data:active { transform: scale(0.995); }
.data-table__row--data.data-table__row--selected { background: linear-gradient(color-mix(in srgb, var(--primary) 10%, transparent), color-mix(in srgb, var(--primary) 10%, transparent)), var(--background); }
/* #67 - Clickable row (opt-in `rowClickable`). */
.data-table__row--clickable { cursor: pointer; }
.data-table__row--clickable:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }
.data-table__select-cell { display: flex; align-items: center; justify-content: center; }

/* ── Cards ───────────────────────────────────────────────────────────────────────────────── */
/* Each card is as tall as its content; rows pack at the top. */
.data-table__cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 0.75rem; padding: 1rem; grid-auto-rows: max-content; align-content: start; align-items: start; }
/* Native ion-card: Ionic's own background, radius and elevation; the grid gives the gap. */
ion-card.data-table__card { margin: 0; }
.data-table__card--selected { outline: 2px solid var(--primary); outline-offset: -2px; }
/* #74 - Clickable card (opt-in `rowClickable`). */
.data-table__card--clickable { cursor: pointer; }
.data-table__card--clickable:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }
@media (prefers-reduced-motion: reduce) {
  .data-table__cell--sortable:hover, .data-table__cell--sortable:active,
  .data-table__row--data:hover, .data-table__row--data:active { transform: none; }
}
/* #79 - The head is ONE row: Ionic's ios host CSS gives ion-card-header a column direction. */
.data-table__card-head { display: flex; flex-direction: row; flex-wrap: nowrap; align-items: center; gap: 0.5rem; }
.data-table__card-icon { display: inline-flex; color: var(--primary); }
.data-table__card-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.data-table__card-body { display: flex; flex-direction: column; gap: 0.4rem; }
.data-table__field { display: flex; justify-content: space-between; gap: 0.5rem; font-size: 13px; }
.data-table__field-label { color: var(--color-muted); }
.data-table__field-value { font-weight: 500; text-align: right; color: var(--color); }
.data-table__card-actions { display: flex; justify-content: flex-end; gap: 0.25rem; padding: 0 0.5rem 0.5rem; }
/* ERPlora/appointments#154 - A card's action row never clips: it wraps. Only on the card: the
   list's row is measured to pin its track (#121). */
.data-table__card-actions .data-table__actions { flex-wrap: wrap; }

/* ── States ──────────────────────────────────────────────────────────────────────────────── */
.data-table__empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem; padding: 3.5rem 1rem; text-align: center; color: var(--color-muted); }
/* pm#530 - Same frame as «empty»; its heading reads as text. */
.data-table__error { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem; padding: 3.5rem 1rem; text-align: center; color: var(--color-muted); }
/* #268 - Same frame as «empty», a spinner instead of the tray. */
.data-table__loading { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem; padding: 3.5rem 1rem; text-align: center; color: var(--color-muted); }
.data-table__loading ion-spinner { width: 28px; height: 28px; color: var(--ion-color-primary, #3880ff); }
.data-table__error .data-table__error-title { color: var(--color); font-weight: 600; }
.data-table__error .data-table__state-icon { color: var(--ion-color-danger, #c5000f); }
.data-table__error ion-button { margin-top: 0.25rem; }
.data-table__empty .data-table__state-icon, .data-table__error .data-table__state-icon { display: grid; place-items: center; width: 3.25rem; height: 3.25rem; border-radius: 999px; background: var(--header-background); font-size: 26px; }

/* ── Row actions ─────────────────────────────────────────────────────────────────────────── */
.data-table__actions { display: flex; gap: 0.25rem; justify-content: flex-end; }
/* #121 - The buttons NEVER shrink: their track is pinned to this very measurement. */
.data-table__actions ion-button { flex: 0 0 auto; }
/* §3b/§6.16 - An action with `showLabel`: its icon and its text, as the mockups paint it. */
.data-table__actions .data-table__action--labelled { font-size: 13px; font-weight: 500; --padding-start: 0.5rem; --padding-end: 0.6rem; }
.data-table__action--labelled > [slot="start"] { margin-inline: 0 0.3rem; }
/* #240 - Stand-in of a hidden action: its width, nothing painted. */
.data-table__actions .data-table__action-gap { visibility: hidden; }
/* #122/#211 - Named for assistive tech, not painted. */
.data-table__sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
/* Touch: the whole button (not only its icon) reaches 44×44. */
@media (pointer: coarse), (max-width: 834px) {
  .data-table__actions ion-button { min-width: 44px; min-height: 44px; margin: 0; }
  .data-table__view-segment ion-segment-button { min-height: 44px; }
  .data-table__add-button { min-height: 44px; }
  .data-table__pager-nav ion-button { min-width: 44px; min-height: 44px; margin: 0; }
  .data-table__error ion-button { min-height: 44px; --padding-start: 1rem; --padding-end: 1rem; }
}
/* Action in progress: spinner sized inside the small button. */
.data-table__actions ion-spinner { width: 18px; height: 18px; }

/* ── Footer: count + paging ──────────────────────────────────────────────────────────────── */
.data-table__pager { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.55rem 1rem; border-top: 1px solid var(--border-color); background: var(--header-background); font-size: 12.5px; color: var(--color-muted); }
.data-table__pager-info { display: flex; align-items: center; gap: 0.6rem; }
.data-table__pager-count { font-weight: 600; color: var(--color); }
.data-table__pager-size { font: inherit; font-size: 12.5px; padding: 0.2rem 0.35rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--background); color: var(--color); }
.data-table__pager-nav { display: flex; align-items: center; gap: 0.2rem; }
/* #78 - One «Load more» on a phone, 44px tall. */
.data-table__load-more { min-height: 44px; margin: 0; --padding-start: 1rem; --padding-end: 1rem; font-size: 13px; }
/* #92 - A page button matches the 44px of prev/next. */
.data-table__page { min-width: var(--ep-tap-min, 44px); height: var(--ep-tap-min, 44px); padding: 0 0.4rem; border: 1px solid transparent; border-radius: 8px; background: none; font: inherit; font-size: 12.5px; font-weight: 600; color: var(--color); cursor: pointer; transition: background 0.12s, border-color 0.12s; }
.data-table__page:hover { background: var(--row-hover); }
.data-table__page.data-table__page--current { background: color-mix(in srgb, var(--primary) 14%, transparent); color: var(--primary); border-color: color-mix(in srgb, var(--primary) 40%, transparent); }
.data-table__page-gap { padding: 0 0.15rem; color: var(--color-muted); }
ion-button { --box-shadow: none; }
</style>

<style>
/* Unscoped on purpose: these rules must stay as WEAK as they were in the Lit shadow root, where
   Ionic's own scoped searchbar classes (`.sc-ion-searchbar-ios-h`, 0,1,0) beat them on every
   property both set: the box keeps Ionic's 12px padding and its grey field (measured: 60px tall).
   A scoped copy would carry Vue's attribute and win. `:where()` limits them to the table. */
:where(.data-table__search) ion-searchbar { --background: var(--background); --border-radius: 10px; padding: 0; min-height: 36px; }
:where(.data-table__search) ion-searchbar.ion-no-border { --box-shadow: none; }
/* normalize.css and Tailwind's preflight never reached Ionic's inner input and clear button in the
   shadow root: they keep the browser's own line height, font and cursor. */
:where(.data-table__search) .searchbar-input { line-height: normal; }
:where(.data-table__search) .searchbar-clear-button { font: revert; cursor: revert; }
</style>
