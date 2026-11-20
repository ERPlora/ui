<script setup lang="ts" generic="T extends object">
// The record list: Ionic controls inside, no network and no business logic.
//
// What fits is decided by the table's OWN box (a ResizeObserver on it), never by the window: with the
// side menu open the box is far narrower than the screen. A list row shows two icon buttons at most and
// «⋮» for the rest; a card, its main action and «⋮». When the list does not fit, it gives up the
// `priority: 'low'` columns, then every row action but the pinned ones, and takes them back as the box
// widens; then the list becomes cards (when `views` offers them and no view was picked by hand). Only
// then does the list scroll sideways inside its box; the page never does. At or below `cardBreakpoint`
// (a phone) the table is cards whatever its box. The `row-actions` slot never folds: it is only for a
// control that cannot be an action.
//
// The cards, and a phone's list, have no pager: `rows` is a WINDOW from the first row that the end of the
// scroll asks the parent to grow (`loadMore`, never `pageChange`); past `maxWindow` they page there too.
// Only the filter names the columns declare are sent: the server answers 422 `unknown_filter` to any other.
//
// The e2e tests of the apps find the table by its `testid` hooks: `<testid>-search`, `-add`, `-view`,
// `-row` (rows and cards, key in `data-id`), `-row-<key>-<action>`, `-loading`, `-retry`, `-page-prev`,
// `-page-next`, `-filters`, `-filter-<name>` (a range: `-filter-<key>_from`, `-filter-<key>_to`; a
// lookup adds `-chosen`, `-clear`, `-search`, `-option`, `-empty`, `-error`, `-field-error`),
// `-filters-clear`, `-filters-toggle`, `-filters-count`, `-filters-panel`, `-filters-apply`,
// `-filters-close`…
import {
  IonButton,
  IonCheckbox,
  IonChip,
  IonIcon,
  IonInput,
  IonLabel,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
} from '@ionic/vue';
import { computed, nextTick, onMounted, onUpdated, ref, watch } from 'vue';

import { ionIconSrc } from '../../shell/icons';
import DataTableCard from './DataTableCard.vue';
import DataTableFilterPanel from './DataTableFilterPanel.vue';
import DataTableInfinite from './DataTableInfinite.vue';
import DataTableListItem from './DataTableListItem.vue';
import DataTablePager from './DataTablePager.vue';
import DataTableRowMenu from './DataTableRowMenu.vue';
import DataTableLookup from './DataTableLookup.vue';
import DataTableState from './DataTableState.vue';
import { useDataTableLabels } from './labels';
import {
  activeFilters,
  DATA_TABLE_ICONS,
  declaredFilters,
  filterColumnsOf,
  filterCount,
  filterRows,
  gridTemplate,
  pagerState,
  phonePages,
  rowKeyOf,
  sameRecords,
  searchRows,
} from './model';
import { cardRowActions, listRowActions } from './rowActions';
import { useCardParts } from './useCardParts';
import { useColumnSort } from './useColumnSort';
import { useFilterControls } from './useFilterControls';
import { useMediaQuery } from './useMediaQuery';
import { useRowMenu } from './useRowMenu';
import { useRowSelection } from './useRowSelection';
import { syncSearchbarInputName } from './searchbarName';
import type {
  DataTableAction,
  DataTableActionCell,
  DataTableActionEvent,
  DataTableToggleEvent,
  DataTableColumn,
  DataTableEntityLabel,
  DataTableFilterField,
  DataTableFilters,
  DataTableLabels,
  DataTablePrimaryAction,
  DataTableRowKey,
  DataTableSort,
  DataTableSortDir,
  DataTableView,
} from './types';
import { type DataTableFitStep, useDataTableLayout } from './useDataTableLayout';
import { useFilterSheet } from './useFilterSheet';

const props = withDefaults(
  defineProps<{
    columns: DataTableColumn<T>[];
    /** The records. Server mode: only the current page. */
    rows: T[];
    /** Stable key of a row: a field or a function (`id` by default). */
    rowKey?: DataTableRowKey<T>;
    pageSize?: number;
    /** Options of the rows-per-page selector; empty = no selector (and no footer on a single page). */
    pageSizeOptions?: number[];
    /** The rows-per-page selector (on by default). Off: no selector, and the footer still counts. */
    pageSizeChooser?: boolean;
    /** No rows at all. Default: the «No results» label. */
    emptyMessage?: string;
    /** Client mode: rows exist but the search hides them all. Default: the «noMatches» label. */
    noMatchesMessage?: string;
    /** Why the rows could not be loaded: an error state with «Retry» (emits `retry`) instead of rows.
     *  Painted under the `loadError` title unless it only repeats it. */
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
    /** The column filters live behind the toolbar's funnel (with the count in use), in a panel inside
     *  the table, instead of a row under the toolbar. Same `filters`, `filtersChange` and hooks. The
     *  cards fold them so without it; this folds them in the list view too. */
    filterable?: boolean;
    /** Filters with no column of their own (a field the list does not paint): after the columns' own,
     *  in the panel and the filter row; never in the column chooser (`DataTableFilterField`). */
    filterFields?: DataTableFilterField[];
    /** What the server refused (a 422's `fieldErrors`, or the page's own reading of an amount), by
     *  filter name: painted under its control until that value changes; the funnel turns red. */
    filterErrors?: Record<string, string>;
    /** Sort, page and search are the parent's: they are emitted, never applied to `rows`. */
    serverSide?: boolean;
    /** Server mode: records of the whole query. */
    total?: number;
    /** Server mode: current page, 0-based. */
    page?: number;
    /** Server mode, windowed (cards, a phone): the most rows the parent can keep in its window (the server's
     *  longest page). A query with more pages there too (previous / next) instead of growing at the end of
     *  the scroll; without it, the window always grows. */
    maxWindow?: number;
    /** Server mode: active sort column. */
    sort?: string;
    /** Server mode: direction of the active sort. */
    sortDir?: DataTableSortDir;
    /** Overrides of the chrome texts for this table (the rest come from i18n). */
    labels?: Partial<DataTableLabels>;
    /** Row action buttons (emit `action`). Every row action goes here, not in the `row-actions`
     *  slot: these fold into «⋮» when the box is narrow. Mark the row's main one `pinned`
     *  (it never folds) and a delicate one `menuOnly` (never a button). */
    actions?: DataTableAction<T>[];
    /** Buttons a list row keeps, two at most (and by default); the rest go into «⋮», a `pinned` one
     *  taking a place first. A card keeps one, its main action. */
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
    defaultView?: DataTableView;
    /** The whole row (and card) opens the record: emits `rowClick`, also on Enter/Space. */
    rowClickable?: boolean;
    /** Row selection with checkboxes and a selection bar. */
    selectable?: boolean;
    /** `v-model:selected` (row keys). `undefined` = the table keeps its own selection. */
    selected?: string[];
    cardTitle?: (row: T) => string | number | null | undefined;
    /** Key of the column the card title stands for: never repeated in the card body, even when the
     *  title's text is not that column's (a name over a code). Without `cardTitle`, the title is
     *  that column's painted text. Without it, the body leaves out the column whose text IS the
     *  title. */
    cardTitleColumn?: string;
    cardIcon?: (row: T) => string | undefined;
    /** Phone breakpoint in px of the WINDOW (640 by default): at or below it the table behaves as on a
     *  phone (cards when `views` offers them, no pager, no column chooser). Per table: raise it for
     *  a wide list (Businesses 900, Members or Invoices 1100…). It is a floor: above it the cards
     *  still come when the list does not fit its own box. */
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
    filterErrors: undefined,
    filterFields: undefined,
    total: 0,
    page: 0,
    maxWindow: undefined,
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
  /** Server mode, windowed (cards, a phone): grow the window of `rows` by one page, from the first row. */
  loadMore: [];
  /** A column's switch was flipped (`DataTableColumn.toggle`). */
  toggle: [payload: DataTableToggleEvent<T>];
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
/** Rows the end of the scroll has accumulated while windowed (0 = one page). */
const mobileShown = ref(0);
/** The person's pick in the column chooser, per key; untouched columns follow their `hidden`. */
const columnChoice = ref(new Map<string, boolean>());

const keyOf = (row: T): string => rowKeyOf(row, props.rowKey ?? ('id' as DataTableRowKey<T>));
const tid = (suffix: string): string | undefined => {
  const prefix = props.testid?.trim();
  return prefix ? `${prefix}-${suffix}` : undefined;
};

/** Columns the person sees: their `hidden`, unless picked otherwise in the column chooser. */
const visibleColumns = computed(() => props.columns.filter((c) => columnChoice.value.get(c.key) ?? c.hidden !== true));
const cellColumns = computed(() => visibleColumns.value.filter((column) => column.cell));
/** Shown columns the box may take away: `low`, and not picked by hand. */
const yieldingColumns = computed(() =>
  visibleColumns.value.filter((c) => c.priority === 'low' && columnChoice.value.get(c.key) !== true),
);
const hasSearch = computed(() => props.searchable || props.searchKeys.length > 0);
const viewToggle = computed(() => (Array.isArray(props.views) ? props.views.length > 1 : props.views === true));
const cardViewEnabled = computed(() => (Array.isArray(props.views) ? props.views.includes('cards') : props.views === true));
const hasActions = computed(() => props.actions.length > 0 || !!slots['row-actions']);
/** The ladder of THIS table: only the steps that free something. */
const fitSteps = computed(() => {
  const steps: DataTableFitStep[] = [];
  if (yieldingColumns.value.length) steps.push('hideLow');
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
  clipColumns: () => visibleColumns.value.filter((c) => c.width == null),
  columnKeys: () => listColumns.value.map((c) => (c.width == null ? c.key : null)),
  rowsKey: () => pager.value.visible.map((row) => keyOf(row)).join('\u241f'),
  deps: () => [props.columns, props.actions, columnChoice.value, props.selectable, props.maxInlineActions, fitStepsKey.value],
  shape: () =>
    JSON.stringify([
      visibleColumns.value.map((c) => [c.key, c.width ?? '', c.minWidth ?? '', yieldingColumns.value.includes(c)]),
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
  columnsClipped,
  contentWidths,
  contentAfter,
} = layout;
/** The list's columns: the visible ones, minus the yielding ones while the box hides them. */
const listColumns = computed(() =>
  lowColumnsHidden.value ? visibleColumns.value.filter((c) => !yieldingColumns.value.includes(c)) : visibleColumns.value,
);
/** The table paints cards: picked, the default, the box's fit or a phone (`cardBreakpoint`). */
const cardsOn = computed(() => viewMode.value === 'cards' && cardViewEnabled.value);
/** Rows grow from the first one at the end of the scroll (the cards, and a phone's list) instead of paging. */
const windowed = computed(() => isMobile.value || cardsOn.value);

// ── Column filters ────────────────────────────────────────────────────────────────────────────
/** The active filters on screen (own state; `filters` from the parent overrides it, like `search`). */
const filterValues = ref<DataTableFilters>({});
/** Every filter, as a column: the columns' own in column order, then `filterFields` (types.ts). */
const filterColumns = computed(() => filterColumnsOf(props.columns, props.filterFields));
/** The filtered columns (a range counts once): a name no column declares is no filter. */
const filterCountNow = computed(() => filterCount(filterColumns.value, filterValues.value));
const filtering = computed(() => filterCountNow.value > 0);
const sameFilters = (a: DataTableFilters, b: DataTableFilters): boolean => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
};

function setFilters(next: DataTableFilters): void {
  const active = declaredFilters(filterColumns.value, next);
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
  answerError(name);
  setFilters({ ...filterValues.value, [name]: value === null || value === undefined ? '' : String(value) });
}
function clearFilters(): void {
  setFilters({});
}
// ── Filters panel (`filterable`) ─────────────────────────────────────────────────────────────
/** The column filters live behind the funnel: `filterable`, or the cards (an open row of controls would
 *  take half a phone before the first card). */
const filtersFolded = computed(() => props.filterable || cardsOn.value);
const filterPanelOpen = ref(false);
const showFunnel = computed(() => filtersFolded.value && filterColumns.value.length > 0);
const funnelName = computed(() => {
  if (refused.value) return label('filtersInvalid');
  const n = filterCountNow.value;
  if (!n) return label('filters');
  return label(n === 1 ? 'filtersActiveOne' : 'filtersActiveMany', { n });
});
// Below 834 px the panel is a sheet over the content area: where that area begins and ends.
const { sheet: panelIsSheet } = useFilterSheet(() => root.value, () => filterPanelOpen.value);

function openFilterPanel(): void {
  filterPanelOpen.value = true;
  void nextTick(() => root.value?.querySelector<HTMLElement>(':scope > .data-table__surface > .data-table__drawer')?.focus());
}
/** Closes the panel (its draft is dropped) and gives the focus back to the funnel. */
function closeFilterPanel(): void {
  if (!filterPanelOpen.value) return;
  filterPanelOpen.value = false;
  void nextTick(() => {
    const funnel = root.value?.querySelector<HTMLElement>('.data-table__filter-button');
    // An ion-button does not delegate its focus: its native button takes it.
    (funnel?.shadowRoot?.querySelector<HTMLElement>('button') ?? funnel)?.focus();
  });
}
function toggleFilterPanel(): void {
  if (filterPanelOpen.value) closeFilterPanel();
  else openFilterPanel();
}
/** «Apply» of the panel: its draft applied, and the panel closed. */
function applyFilterPanel(draft: DataTableFilters): void {
  setFilters(draft);
  closeFilterPanel();
}
// Its columns stopped declaring filters, the page dropped `filterable` or the list came back from the
// cards: nothing left to show (what was applied stays).
watch(showFunnel, (shown) => {
  if (!shown) filterPanelOpen.value = false;
});

// ── What a filter control paints besides its value (`filterErrors`, lookups, ranges) ─────────
const filterControls = useFilterControls<T>({ filterErrors: () => props.filterErrors, label });
const { filterName, errorOf, invalidMark, refused, answerError, choicesOf, lookupLabel, rememberPick, endBox, rangeEnds } = filterControls;
/** A lookup of the filter row: applied at once. */
function onLookup(name: string, value: string, text: string): void {
  rememberPick(name, value, text);
  answerError(name);
  setFilters({ ...filterValues.value, [name]: value });
}

// ── Sorting ───────────────────────────────────────────────────────────────────────────────────
const { isSortable, isSorted, caretIcon, ariaSort, onHeaderClick, sortedRows } = useColumnSort<T>({
  serverSide: () => props.serverSide,
  sort: () => props.sort,
  sortDir: () => props.sortDir,
  columns: () => props.columns,
  emit: (sort) => emit('sortChange', sort),
  // Reordering changes WHICH rows the accumulated window holds.
  reordered: () => {
    mobileShown.value = 0;
  },
});

// ── Rows on screen ────────────────────────────────────────────────────────────────────────────
const clientRows = computed(() =>
  sortedRows(filterRows(searchRows(props.rows, props.searchKeys, q.value), filterColumns.value, filterValues.value)),
);
const pageSizeNow = computed(() => (props.serverSide ? props.pageSize : clientPageSize.value || props.pageSize));
const pager = computed(() =>
  pagerState({
    serverSide: props.serverSide,
    rows: props.serverSide ? props.rows : clientRows.value,
    total: props.total,
    page: props.serverSide ? props.page : clientPage.value,
    pageSize: pageSizeNow.value,
    isMobile: windowed.value,
    mobileShown: mobileShown.value,
    maxWindow: props.maxWindow,
  }),
);
/** Windowed in server mode with a query longer than the parent's window: it pages instead of growing. */
const phonePaged = computed(() =>
  phonePages({ serverSide: props.serverSide, isMobile: windowed.value, total: props.total, maxWindow: props.maxWindow }),
);

const hasError = computed(() => !!props.error?.trim());
/** A load in flight with nothing current to show (no rows yet, or only the failure). */
const awaitingRows = computed(() => props.loading && (props.rows.length === 0 || hasError.value));
/** The last load failed: rows, «empty» and counts would all be claims about missing data. */
const loadFailed = computed(() => hasError.value && !awaitingRows.value);
/** A text as it reads aloud: case, spacing and the closing full stop aside. */
const asRead = (text: string) => text.trim().replace(/\s+/g, ' ').replace(/[.!…]+$/u, '').toLocaleLowerCase();
/** The reason under the title, unless it only repeats the title (pages often hand the same text). */
const errorReason = computed(() => (asRead(props.error ?? '') === asRead(label('loadError')) ? '' : props.error));
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
/** `hideToolbarWhenEmpty` and no record at all: loaded, not failed, nothing searched. */
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
/** What the column chooser marks: what the current view paints (the cards keep the low columns). */
const shownColumns = computed(() => (cardsOn.value ? visibleColumns.value : listColumns.value));
/** Rows that exist but are all hidden by the search are not an empty list. */
const noMatches = computed(() => props.rows.length > 0);
const searchHint = computed(() => props.searchPlaceholder ?? label('search'));
const template = computed(() =>
  gridTemplate({
    selectable: props.selectable,
    columns: listColumns.value,
    hasActions: hasActions.value,
    actionsTrackPx: actionsTrackPx.value,
    contentWidths: contentWidths.value,
    clipped: columnsClipped.value,
  }),
);

// ── Watchers ──────────────────────────────────────────────────────────────────────────────────
// `search` from the parent is the query the person is looking at; `undefined` = not controlled.
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
    // A phone that pages scrolls WITH the page: tapped at the foot, the new page would open at its end.
    if (scrollToNewPage) {
      scrollToNewPage = false;
      root.value?.scrollIntoView({ block: 'start' });
    }
    // A new result set starts at one page; the same records refreshed keep the window.
    if (!props.serverSide && mobileShown.value !== 0 && !sameRecords(before, now, keyOf)) mobileShown.value = 0;
  },
);

// A server window is the parent's: a phone counts from row 1 and a desk shows one page, so
// crossing the breakpoint asks for the first page again unless the window already is just that.
watch(windowed, () => {
  if (props.serverSide && (props.page !== 0 || props.rows.length > props.pageSize)) emit('pageChange', 0);
});

// ── Selection ─────────────────────────────────────────────────────────────────────────────────
const { selection, allSelected, setSelection, toggleRow, toggleAll } = useRowSelection<T>({
  selected: () => props.selected,
  visible: () => pager.value.visible,
  keyOf,
  emit: (keys) => emit('update:selected', keys),
});

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
 *  touched stays the box's to bring back. */
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
/** The list/cards ion-segment: anything but a view is ignored. */
function onViewPicked(ev: CustomEvent<{ value?: unknown }>): void {
  const view = ev.detail.value;
  if (view !== 'table' && view !== 'cards') return;
  if (layout.setViewMode(view)) emit('viewChange', view);
}
/** «Show all»: drops the search and the column filters, so every row is back in one tap. */
function resetSearch(): void {
  q.value = '';
  clientPage.value = 0;
  mobileShown.value = 0;
  emit('update:search', '');
  clearFilters();
}

// ── Pager ─────────────────────────────────────────────────────────────────────────────────────
/** A phone paging past `maxWindow` asked for another page: its rows show from the first once they arrive. */
let scrollToNewPage = false;
function goTo(page: number): void {
  if (phonePaged.value) scrollToNewPage = true;
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
const onPageSizeSelect = (ev: CustomEvent<{ value?: unknown }>): void => setPageSize(Number(ev.detail.value));
function loadMore(): void {
  if (props.serverSide) emit('loadMore');
  else mobileShown.value = Math.min((mobileShown.value || pageSizeNow.value) + pageSizeNow.value, pager.value.count);
}
/** A table that fills its page scrolls its cards itself, but not at a phone's width, where its CSS lets the
 *  page scroll: Ionic listens to the cards, or to the page. */
const phoneWidth = useMediaQuery('(max-width: 640px)');
const ownScroll = computed(() => props.fill && !phoneWidth.value);
const infinite = computed(() => ({
  disabled: !pager.value.canLoadMore || awaitingRows.value,
  shown: pager.value.visible,
  failed: loadFailed.value, waiting: props.loading,
  label: label('loadingMore'),
}));

// ── Rows and cells ────────────────────────────────────────────────────────────────────────────
const rowId = (row: T, index: number): string => keyOf(row) || `#${index}`;
const alignClass = (column: DataTableColumn<T>): string | undefined =>
  column.align === 'right' ? 'data-table__cell--right' : column.align === 'center' ? 'data-table__cell--center' : undefined;

// ── Row actions ───────────────────────────────────────────────────────────────────────────────
const listActions = (row: T): DataTableActionCell<T> =>
  listRowActions(props.actions, row, { maxInline: props.maxInlineActions, folded: rowActionsCollapsed.value });
const cardActions = (row: T): DataTableActionCell<T> => cardRowActions(props.actions, row);
function runAction(action: DataTableAction<T>, row: T): void {
  emit('action', { actionId: action.id, row });
}

const {
  open: rowMenuOpen,
  event: rowMenuEvent,
  row: menuRow,
  actions: menuActions,
  openFor: openRowMenu,
  pick: pickMenuAction,
} = useRowMenu<T>({ rows: () => props.rows, keyOf, menuOf: (row) => (cardsOn.value ? cardActions(row) : listActions(row)).menu, run: runAction });

// ── Cards ─────────────────────────────────────────────────────────────────────────────────────
const { cardTitleOf, cardTitleColumnOf, cardFields } = useCardParts<T>({
  columns: () => props.columns,
  visible: () => visibleColumns.value,
  title: () => props.cardTitle,
  titleColumn: () => props.cardTitleColumn,
});

// The search box is named after its hint, and its clear button with its own text, after every render.
function nameSearchBox(): void {
  syncSearchbarInputName(
    root.value?.querySelector(':scope > .data-table__surface > .data-table__bar') ?? null,
    () => searchHint.value,
    () => label('clearSearch'),
  );
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
      :class="['data-table__surface', { 'data-table__surface--panel': filterPanelOpen }]"
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
          <!-- The list/cards switch is Ionic's segment: it marks the checked one. -->
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
          <!-- The funnel, solid while filtering, with the count of filtered columns.
               A toggle (`aria-pressed`): an ion-button hands a CHANGED aria-label/-pressed/-checked to its
               native button, never an aria-expanded (it stays on the host, where no reader sees it). -->
          <ion-button
            v-if="showFunnel"
            class="data-table__filter-button"
            size="small"
            :fill="filterPanelOpen || filtering ? 'solid' : 'outline'"
            :color="refused ? 'danger' : undefined"
            :data-invalid="refused ? 'true' : undefined"
            :title="label('filters')"
            :aria-label="funnelName"
            :aria-pressed="filterPanelOpen ? 'true' : 'false'"
            :data-testid="tid('filters-toggle')"
            @click="toggleFilterPanel"
          >
            <ion-icon
              slot="icon-only"
              :icon="icon(ICONS.filters)"
              aria-hidden="true"
            />
            <span
              v-if="filtering"
              class="data-table__filter-count"
              aria-hidden="true"
              :data-testid="tid('filters-count')"
            >{{ filterCountNow }}</span>
          </ion-button>
          <!-- The main action of the screen is read, not guessed: labelled in every viewport. -->
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
              aria-hidden="true"
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
              aria-hidden="true"
            />{{ primaryAction.label }}
          </ion-button>
          <slot name="toolbar" />
        </div>
        <!-- Column filters: one control per filtered column, in column order. -->
        <div
          v-if="filterColumns.length && !filtersFolded"
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
              v-if="column.filter?.type === 'select' || column.filter?.type === 'boolean'"
              class="data-table__filter"
              :class="invalidMark(filterName(column))"
              interface="popover"
              :aria-label="column.label"
              :placeholder="column.label"
              :value="filterValues[filterName(column)] ?? ''"
              :selected-text="filterValues[filterName(column)] ? undefined : column.label"
              :error-text="errorOf(filterName(column))"
              :data-testid="tid(`filter-${filterName(column)}`)"
              @ion-change="onFilter(filterName(column), $event)"
            >
              <ion-select-option value="">
                {{ label('filterAll') }}
              </ion-select-option>
              <ion-select-option
                v-for="option in choicesOf(column)"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </ion-select-option>
            </ion-select>
            <!-- A range is headed by its column, «Total  From  To»: its ends alone say only «From» / «To», and a
                 date box paints «dd/mm/yyyy», never a placeholder. The group already names it for assistive tech. -->
            <span
              v-else-if="column.filter?.type === 'range' || column.filter?.type === 'daterange'"
              class="data-table__filter-range"
              :class="{ 'data-table__filter-range--date': column.filter?.type === 'daterange' }"
              role="group"
              :aria-label="column.label"
            >
              <span
                class="data-table__filter-range-label"
                aria-hidden="true"
              >{{ column.label }}</span>
              <ion-input
                v-for="{ name, hint, named } in rangeEnds(column)"
                :key="name"
                class="data-table__filter"
                :class="invalidMark(name)"
                v-bind="endBox(column)"
                :debounce="250"
                :aria-label="named"
                :placeholder="hint"
                :value="filterValues[name] ?? ''"
                :error-text="errorOf(name)"
                :data-testid="tid(`filter-${name}`)"
                @ion-input="column.filter?.type === 'range' && onFilter(name, $event)"
                @ion-change="column.filter?.type === 'daterange' && onFilter(name, $event)"
              />
            </span>
            <ion-input
              v-else-if="column.filter?.type === 'date'"
              class="data-table__filter"
              :class="invalidMark(filterName(column))"
              type="date"
              :aria-label="column.label"
              :value="filterValues[filterName(column)] ?? ''"
              :error-text="errorOf(filterName(column))"
              :data-testid="tid(`filter-${filterName(column)}`)"
              @ion-change="onFilter(filterName(column), $event)"
            />
            <DataTableLookup
              v-else-if="column.filter?.type === 'lookup'"
              :label="column.label"
              :value="filterValues[filterName(column)] ?? ''"
              :display="lookupLabel(column, filterValues[filterName(column)])"
              :load="column.filter.load"
              :error-text="errorOf(filterName(column))"
              :labels="labels"
              :testid="tid(`filter-${filterName(column)}`)"
              @change="(value: string, text: string) => onLookup(filterName(column), value, text)"
            />
            <ion-input
              v-else
              class="data-table__filter"
              :class="invalidMark(filterName(column))"
              type="text"
              :clear-input="true"
              :debounce="250"
              :maxlength="column.filter?.type === 'text' ? column.filter.maxlength : undefined"
              :aria-label="column.label"
              :placeholder="column.label"
              :value="filterValues[filterName(column)] ?? ''"
              :error-text="errorOf(filterName(column))"
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
          <ion-button
            class="data-table__selection-clear"
            fill="clear"
            size="small"
            @click="setSelection(new Set())"
          >
            <ion-icon
              :icon="icon(ICONS.clear)"
              style="font-size: 14px"
              aria-hidden="true"
            />{{ ` ${label('clear')}` }}
          </ion-button>
        </div>
      </div>

      <DataTableState
        v-if="awaitingRows"
        kind="loading"
        :labels="{ loading: label('loading'), errorTitle: label('loadError'), empty: '', retry: label('retry'), reset: label('showAll') }"
        :testid="testid?.trim() || undefined"
      />
      <DataTableState
        v-else-if="loadFailed"
        kind="error"
        :labels="{ loading: label('loading'), errorTitle: label('loadError'), empty: '', retry: label('retry'), reset: label('showAll') }"
        :error-reason="errorReason"
        :testid="testid?.trim() || undefined"
        @retry="emit('retry')"
      />
      <DataTableState
        v-else-if="pager.visible.length === 0"
        kind="empty"
        :labels="{ loading: label('loading'), errorTitle: label('loadError'), empty: noMatches ? (noMatchesMessage ?? label('noMatches')) : (emptyMessage ?? label('empty')), retry: label('retry'), reset: label('showAll') }"
        :can-reset="noMatches"
        :testid="testid?.trim() || undefined"
        @reset="resetSearch"
      >
        <template
          v-if="slots.empty"
          #empty
        >
          <slot name="empty" />
        </template>
      </DataTableState>

      <div
        v-else-if="cardsOn"
        :class="['data-table__cards', { 'ion-content-scroll-host': ownScroll }]"
      >
        <DataTableCard
          v-for="(row, index) in pager.visible"
          :key="rowId(row, index)"
          :row="row"
          :rows="rows"
          :row-id="rowId(row, index)"
          :title="cardTitleOf(row)"
          :title-column="cardTitleColumnOf(row)"
          :icon="cardIcon?.(row)"
          :fields="cardFields(row)"
          :actions="cardActions(row)"
          :selectable="selectable"
          :selected="selection.has(keyOf(row))"
          :clickable="rowClickable"
          :has-actions="hasActions"
          :select-label="label('select')"
          :more-label="label('moreActions')"
          :testid="testid?.trim() || undefined"
          @open="emit('rowClick', $event)"
          @select="toggleRow"
          @action="runAction($event.action, $event.row)"
          @menu="openRowMenu"
          @toggle="emit('toggle', $event)"
        >
          <template
            v-if="slots.card"
            #card="{ row: cardRow }"
          >
            <slot
              name="card"
              :row="cardRow"
            />
          </template>
          <template
            v-if="slots['row-actions']"
            #row-actions="{ row: actionRow }"
          >
            <slot
              name="row-actions"
              :row="actionRow"
            />
          </template>
          <template
            v-for="column in cellColumns"
            :key="column.key"
            #[column.cell]="cellProps"
          >
            <slot
              :name="column.cell"
              v-bind="cellProps"
            />
          </template>
        </DataTableCard>
        <DataTableInfinite
          :key="ownScroll ? 'own' : 'page'"
          v-bind="infinite"
          @more="loadMore"
        />
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
                :aria-sort="ariaSort(column)"
                @click="onHeaderClick(column)"
              >
                <span :title="column.label || undefined">{{ column.label }}</span>
                <span
                  v-if="isSortable(column)"
                  :class="['data-table__caret', { 'data-table__caret--active': isSorted(column) }]"
                ><ion-icon
                  :icon="icon(caretIcon(column))"
                  aria-hidden="true"
                /></span>
              </div>
              <div
                v-if="hasActions"
                class="data-table__cell data-table__cell--header data-table__cell--right data-table__cell--pinned data-table__cell--actions"
                role="columnheader"
              >
                <!-- Named for assistive tech, not painted, when it would not fit. -->
                <span :class="{ 'data-table__sr-only': rowActionsCollapsed || !actionsLabelFits }">{{ label('actions') }}</span>
              </div>
            </div>

            <DataTableListItem
              v-for="(row, index) in pager.visible"
              :key="rowId(row, index)"
              :row="row"
              :rows="rows"
              :row-id="rowId(row, index)"
              :columns="listColumns"
              :template="template"
              :actions="listActions(row)"
              :selectable="selectable"
              :selected="selection.has(keyOf(row))"
              :clickable="rowClickable"
              :has-actions="hasActions"
              :select-label="label('selectRow')"
              :more-label="label('moreActions')"
              :testid="testid?.trim() || undefined"
              @open="emit('rowClick', $event)"
              @select="toggleRow"
              @action="runAction($event.action, $event.row)"
              @menu="openRowMenu"
              @toggle="emit('toggle', $event)"
            >
              <template #row-actions="{ row: actionRow }">
                <slot
                  name="row-actions"
                  :row="actionRow"
                />
              </template>
              <template
                v-for="column in cellColumns"
                :key="column.key"
                #[column.cell]="cellProps"
              >
                <slot
                  :name="column.cell"
                  v-bind="cellProps"
                />
              </template>
            </DataTableListItem>
          </div>
        </div>
        <DataTableInfinite
          v-if="windowed"
          v-bind="infinite"
          @more="loadMore"
        />
      </template>

      <DataTableRowMenu
        v-if="actions.length"
        :open="rowMenuOpen"
        :event="rowMenuEvent"
        :row="menuRow"
        :actions="menuActions"
        :hook="menuRow ? tid(`row-${keyOf(menuRow)}`) : undefined"
        @pick="pickMenuAction"
        @dismiss="rowMenuOpen = false"
      />

      <DataTablePager
        v-if="showPager"
        :pager="pager"
        :windowed="windowed"
        :phone-paged="phonePaged"
        :awaiting-rows="awaitingRows"
        :size-select="!hasToolbar && pageSizeSelectable"
        :page-size="pageSizeNow"
        :page-size-options="pageSizeOptions"
        :entity-label="entityLabel"
        :labels="labels"
        :testid="testid?.trim() || undefined"
        @go="goTo"
        @page-size="setPageSize"
      />

      <!-- `filterable`: the filters panel, inside the table: one control per
           filtered column on a draft; «Clear» lifts them all now, «Apply» applies and closes. -->
      <DataTableFilterPanel
        v-if="filterPanelOpen"
        :filter-columns="filterColumns"
        :applied="filterValues"
        :controls="filterControls"
        :filtering="filtering"
        :sheet="panelIsSheet"
        :labels="labels"
        :testid="testid?.trim() || undefined"
        @apply="applyFilterPanel"
        @clear="clearFilters"
        @close="closeFilterPanel"
      />
    </div>
  </div>
</template>

<style scoped src="./controls.css"></style>

<style scoped>
/* Every rule here is checked against the Lit table's stylesheet by DataTable.lit-parity.test.ts:
   a rule changed, added or dropped is listed there with its reason. */

/* Shell shield: what every part of the table shares is in controls.css; this one only the toolbar needs.
   Ionic's `::slotted(ion-icon[slot=start])` pull; the end margin is the `0.35rem` below. */
:where(.data-table) ion-button > ion-icon[slot="start"] { margin-inline-start: -0.3em; }

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
  /* The filters sheet below 834 px: where the content area begins and ends, and the safe area its
     footer keeps. `useFilterSheet` publishes the measured ones while it is open. */
  --data-table-sheet-top: 0px;
  --data-table-sheet-bottom: 0px;
  --data-table-sheet-safe-bottom: env(safe-area-inset-bottom, 0px);

  display: block;
  color: var(--color);
  font-family: var(--font);
  box-shadow: var(--ep-shadow-sm);
  overflow: hidden;
}
/* The shell's global `*` asks for thin scrollbars; the table keeps the browser's own. */
.data-table :deep(*) { scrollbar-width: auto; }
.data-table__surface {
  position: relative;
  display: flex;
  flex-direction: column;
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
/* On a phone the list scrolls WITH the page; the box only grows when content follows it. */
@media (max-width: 640px) {
  .data-table--fill .data-table__surface { flex: 1 0 auto; }
  .data-table--fill .data-table__scroll, .data-table--fill .data-table__cards { flex: 0 0 auto; }
  .data-table--fill .data-table__cards { overflow: visible; }
  .data-table--fill.data-table--content-after { height: auto; flex-shrink: 0 !important; }
  /* With nothing after it, too: at the container's height (`overflow: hidden`) it would clip its rows
     and its pager and leave the page nothing to scroll. */
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
/* A tablet, without the spacer: the line breaks at the search's 12rem minimum (a wrapping row breaks at each
   item's basis) and the search grows back to its 22rem, so the funnel does not drop alone to a second line
   at 834px or 820px. After the rule above, which it overrides; from 641px, so a phone keeps the search on its own line. */
@media (min-width: 641px) and (max-width: 1024px) { .data-table__search { flex: 1 1 12rem; max-width: 22rem; } }
/* One clear cross: Chromium's native cancel button of `type=search` hidden. Alone in its rule. */
.data-table__search :deep(input::-webkit-search-cancel-button) { -webkit-appearance: none; appearance: none; display: none; }
/* The example text ends in «…» where the box is short of it (otherwise, at 820px it is cut with no sign,
   measured in Chromium). */
.data-table__search :deep(.searchbar-input) { text-overflow: ellipsis; }

/* List/cards switch: Ionic's segment. An ion-segment is 100% wide by default:
   here it takes only its buttons; icon-only buttons as tall as the toolbar controls. */
.data-table__view-segment { flex: 0 0 auto; width: auto; }
.data-table__view-segment ion-segment-button { min-width: 44px; min-height: 44px; }

/* The toolbar's main buttons («Add», `primaryAction`): labelled, filled (controls.css) and at least 44px tall. */
.data-table__add-button { min-height: 44px; --border-radius: 10px; --padding-start: 0.9rem; --padding-end: 1rem; margin: 0; font-weight: 600; }
.data-table__add-button ion-icon { margin-inline-end: 0.35rem; }

/* Toolbar selects: visible background and border, like the search box. */
.data-table__columns-select { min-width: 6.5rem; max-width: 9rem; min-height: 44px; font-size: 13px; background: var(--background); color: var(--color); border: 1px solid var(--control-border); border-radius: 10px; --padding-start: 0.6rem; --padding-end: 0.4rem; --padding-top: 0.3rem; --padding-bottom: 0.3rem; }
.data-table__page-size-select { min-width: 4.25rem; max-width: 5.5rem; min-height: 44px; font-size: 13px; background: var(--background); color: var(--color); border: 1px solid var(--control-border); border-radius: 10px; --padding-start: 0.6rem; --padding-end: 0.4rem; --padding-top: 0.35rem; --padding-bottom: 0.35rem; }
/* A select the page adds in the `filters` (or `toolbar`) slot: boxed like the two above. */
.data-table__bar-main > :slotted(ion-select) { min-width: 6.5rem; max-width: 8rem; min-height: 44px; font-size: 13px; background: var(--background); color: var(--color); border: 1px solid var(--control-border); border-radius: 10px; --padding-start: 0.6rem; --padding-end: 0.4rem; --padding-top: 0.3rem; --padding-bottom: 0.3rem; }

/* Column filters: a row of boxed controls under the toolbar's main row. */
.data-table__filters { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
.data-table__filter { min-width: 8.5rem; max-width: 13rem; min-height: 44px; font-size: 13px; background: var(--background); color: var(--color); border: 1px solid var(--control-border); border-radius: 10px; --padding-start: 0.7rem; --padding-end: 0.5rem; --padding-top: 0.35rem; --padding-bottom: 0.35rem; }
.data-table__filter-range { display: inline-flex; align-items: center; gap: 0.35rem; }
.data-table__filter-range .data-table__filter { min-width: 5.5rem; max-width: 7rem; }
/* A date range's end is as wide as a date field: in a number box the calendar icon covers the last
   character of «dd/mm/yyyy» (measured in Chromium). */
.data-table__filter-range--date .data-table__filter { min-width: 8.75rem; max-width: 8.75rem; }
/* The column heading a range in the row, on one line: a long one ends in «…», never cut with no sign. */
.data-table__filter-range-label { flex: 0 1 auto; min-width: 0; max-width: 10rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; color: var(--color-muted); }
.data-table__filters-clear { margin: 0; font-size: 13px; }

/* ── Filters panel (`filterable`) ────────────────────────────────────────────────────────────
   The funnel: a 44px tool button, solid while filtering, with the count of filtered columns. */
.data-table__filter-button { position: relative; --padding-start: 0; --padding-end: 0; --border-radius: 10px; width: 44px; height: 44px; margin: 0; --overflow: visible; }
.data-table__filter-button .data-table__filter-count { position: absolute; top: -5px; right: -5px; min-width: 16px; height: 16px; padding: 0 3px; border-radius: 999px; background: var(--primary); color: var(--primary-contrast); font-size: 10px; font-weight: 700; line-height: 16px; text-align: center; pointer-events: none; }
/* ≥ 834px: while it is open the surface is a grid of TWO columns (list | 360px panel): the list
   narrows (it scrolls sideways inside) and nothing is covered (Square Dashboard). */
@media (min-width: 834px) {
  .data-table__surface--panel { display: grid; grid-template-columns: minmax(0, 1fr) 360px; grid-template-rows: auto minmax(0, 1fr) auto; }
  .data-table__surface--panel > .data-table__bar { grid-column: 1; grid-row: 1; }
  .data-table__surface--panel > .data-table__scroll, .data-table__surface--panel > .data-table__cards, .data-table__surface--panel > .data-table__empty, .data-table__surface--panel > .data-table__error, .data-table__surface--panel > .data-table__loading { grid-column: 1; grid-row: 2; min-height: 0; overflow: auto; }
  .data-table__surface--panel > .data-table__pager { grid-column: 1; grid-row: 3; }
  .data-table__surface--panel > .data-table__drawer { position: static; grid-column: 2; grid-row: 1 / -1; width: auto; max-width: none; height: auto; min-height: 0; animation: none; }
}
.data-table__selection-bar { display: flex; align-items: center; gap: 0.6rem; padding: 0.4rem 0.7rem; border-radius: 10px; font-size: 13px; color: var(--primary); background: color-mix(in srgb, var(--primary) 12%, transparent); }
/* `padding: revert`: the browser's own button padding, which normalize.css would zero. */
.data-table__selection-clear { margin-left: auto; display: inline-flex; align-items: center; gap: 0.25rem; cursor: pointer; font-weight: 500; color: inherit; background: none; border: 0; font: inherit; padding: revert; }
.data-table__selection-clear:hover { text-decoration: underline; }

/* ── The list, in CSS grid ───────────────────────────────────────────────────────────────── */
/* A permanent horizontal scrollbar when it overflows (the macOS overlay hides itself). */
.data-table__scroll { overflow-x: auto; }
.data-table__scroll::-webkit-scrollbar { height: 10px; }
.data-table__scroll::-webkit-scrollbar-track { background: transparent; }
.data-table__scroll::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--color) 25%, transparent); border-radius: 6px; }
.data-table__scroll::-webkit-scrollbar-thumb:hover { background: color-mix(in srgb, var(--color) 40%, transparent); }
/* The grid floor is the SUM of the column minimums (min-content), not its maximum. */
.data-table__grid { min-width: min-content; font-size: 14px; }
.data-table__row { display: grid; align-items: center; gap: 0.5rem; padding: 0 1rem; }
.data-table__row--head { position: sticky; top: 0; z-index: 2; border-bottom: 1px solid var(--border-color); background: var(--header-background); padding-top: 0.55rem; padding-bottom: 0.55rem; }
.data-table__cell { display: flex; align-items: center; min-width: 0; }
.data-table__cell--header > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.data-table__cell--right { justify-content: flex-end; text-align: right; }
.data-table__cell--center { justify-content: center; text-align: center; }
/* PINNED column (row actions, `pinned: 'end'`): stuck to the right edge, on the row background. */
.data-table__cell--pinned { position: sticky; right: 0; z-index: 1; background: inherit; margin-right: -1rem; padding-right: 1rem; }
/* The shadow only when something is really hidden to the left. */
.data-table__scroll--overflow .data-table__cell--pinned { box-shadow: -10px 0 10px -10px color-mix(in srgb, var(--color) 45%, transparent); }
/* The pinned header is OPAQUE: the tint laid over the table background. */
.data-table__row--head .data-table__cell--pinned { z-index: 3; background: linear-gradient(var(--header-background), var(--header-background)), var(--background); }
.data-table__cell--header { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted); }
.data-table__cell--sortable { cursor: pointer; user-select: none; white-space: nowrap; transition: background-color var(--ep-transition, 150ms ease), color var(--ep-transition, 150ms ease), box-shadow var(--ep-transition, 150ms ease), transform 120ms ease; }
@media (hover: hover) {
  .data-table__cell--sortable:hover { color: var(--color); }
}
/* Sort caret (3 states): neutral dimmed / active in primary. */
.data-table__caret { display: inline-flex; align-items: center; margin-left: 0.25rem; flex: 0 0 auto; font-size: 13px; opacity: 0.3; }
.data-table__caret--active { opacity: 1; color: var(--primary); }
.data-table__select-cell { display: flex; align-items: center; justify-content: center; }

/* ── Cards ───────────────────────────────────────────────────────────────────────────────── */
/* Each card is as tall as its content; rows pack at the top. */
.data-table__cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)); gap: 0.75rem; padding: 1rem; grid-auto-rows: max-content; align-content: start; align-items: stretch; }
@media (prefers-reduced-motion: reduce) {
  .data-table__cell--sortable:hover, .data-table__cell--sortable:active,
  .data-table__row--data:hover, .data-table__row--data:active { transform: none; }
}

/* ── Row actions ─────────────────────────────────────────────────────────────────────────── */
/* Named for assistive tech, not painted. */
.data-table__sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
@media (pointer: coarse), (max-width: 834px) {
  .data-table__view-segment ion-segment-button { min-height: 44px; }
  .data-table__filter-button { width: 44px; height: 44px; }
  .data-table__add-button { min-height: 44px; }
}

.data-table > .data-table__surface {
  border: 1px solid var(--border-color-soft);
}
.data-table > .data-table__surface > .data-table__bar,
.data-table > .data-table__surface > .data-table__pager {
  background: color-mix(in srgb, var(--header-background) 65%, var(--background));
}
</style>

<style>
/* Unscoped on purpose: these rules must stay WEAK, so that Ionic's own scoped searchbar classes
   (`.sc-ion-searchbar-ios-h`, 0,1,0) beat them on every property both set: the box keeps Ionic's
   12px padding and its grey field. A scoped copy would carry Vue's attribute
   and win. `:where()` limits them to the table. */
.data-table ion-checkbox { --size: 24px; width: 44px; height: 44px; margin: -10px; display: grid; place-items: center; }
:where(.data-table__search) ion-searchbar { --background: var(--background); --border-radius: 10px; padding: 0; min-height: 44px; }
:where(.data-table__search) ion-searchbar.ion-no-border { --box-shadow: none; }
/* Focused, the field shows it: the theme's accent ring and a soft halo of the same colour.
   After the rule above, which has the same weight. Ionic's own `--box-shadow: none` is lighter. */
:where(.data-table__search) ion-searchbar:focus-within, :where(.data-table__search) ion-searchbar.searchbar-has-focus { --box-shadow: var(--ep-ring-accent), 0 0 0 3px color-mix(in srgb, var(--ion-color-primary, #3880ff) 25%, transparent); }
/* Ionic's inner input and clear button keep the browser's own line height, font and cursor, which
   normalize.css and Tailwind's preflight would change. */
:where(.data-table__search) .searchbar-input { line-height: normal; }
:where(.data-table__search) .searchbar-clear-button { font: revert; cursor: revert; }
</style>
