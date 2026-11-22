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
import { IonButton, IonIcon } from '@ionic/vue';
import { computed, ref, watch } from 'vue';

import { ionIconSrc } from '../../shell/icons';
import DataTableCard from './DataTableCard.vue';
import DataTableFilterPanel from './DataTableFilterPanel.vue';
import DataTableFilterRow from './DataTableFilterRow.vue';
import DataTableGrid from './DataTableGrid.vue';
import DataTableInfinite from './DataTableInfinite.vue';
import DataTablePager from './DataTablePager.vue';
import DataTableRowMenu from './DataTableRowMenu.vue';
import DataTableState from './DataTableState.vue';
import DataTableToolbar from './DataTableToolbar.vue';
import { useDataTableLabels } from './labels';
import { DATA_TABLE_ICONS, filterRows, gridTemplate, rowKeyOf, searchRows } from './model';
import { cardRowActions, listRowActions } from './rowActions';
import { useCardParts } from './useCardParts';
import { useColumnFilters } from './useColumnFilters';
import { useColumnSort } from './useColumnSort';
import { useFilterControls } from './useFilterControls';
import { useFilterPanel } from './useFilterPanel';
import { useMediaQuery } from './useMediaQuery';
import { usePagination } from './usePagination';
import { useRowMenu } from './useRowMenu';
import { useRowSelection } from './useRowSelection';
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

// ── Pages ─────────────────────────────────────────────────────────────────────────────────────
// Before the column filters: their watcher starts the rows again from the first page as it is created.
const { clientPage, mobileShown, pageSizeNow, pager, phonePaged, goTo, setPageSize, loadMore } = usePagination<T>({
  root,
  serverSide: () => props.serverSide,
  rows: () => props.rows,
  clientRows: () => clientRows.value,
  total: () => props.total,
  page: () => props.page,
  pageSize: () => props.pageSize,
  maxWindow: () => props.maxWindow,
  windowed: () => windowed.value,
  keyOf,
  askPage: (page) => emit('pageChange', page),
  askPageSize: (size) => emit('pageSizeChange', size),
  askMore: () => emit('loadMore'),
});

// ── Column filters ────────────────────────────────────────────────────────────────────────────
const { filterValues, filterColumns, filterCountNow, filtering, setFilters, setFilter, clearFilters } = useColumnFilters<T>({
  columns: () => props.columns,
  filterFields: () => props.filterFields,
  filters: () => props.filters,
  serverSide: () => props.serverSide,
  update: (filters) => emit('update:filters', filters),
  query: (filters) => emit('filtersChange', filters),
  refiltered: () => {
    clientPage.value = 0;
    mobileShown.value = 0;
  },
});
// ── Filters panel (`filterable`) ─────────────────────────────────────────────────────────────
const { filtersFolded, filterPanelOpen, showFunnel, panelIsSheet, closeFilterPanel, toggleFilterPanel, applyFilterPanel } =
  useFilterPanel<T>({
    root,
    filterable: () => props.filterable,
    cardsOn: () => cardsOn.value,
    filterColumns: () => filterColumns.value,
    setFilters,
  });

// ── What a filter control paints besides its value (`filterErrors`, lookups, ranges) ─────────
const filterControls = useFilterControls<T>({ filterErrors: () => props.filterErrors, label });
const { refused } = filterControls;

// ── Sorting ───────────────────────────────────────────────────────────────────────────────────
const sorting = useColumnSort<T>({
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
  sorting.sortedRows(filterRows(searchRows(props.rows, props.searchKeys, q.value), filterColumns.value, filterValues.value)),
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

// ── Selection ─────────────────────────────────────────────────────────────────────────────────
const { selection, allSelected, setSelection, toggleRow, toggleAll } = useRowSelection<T>({
  selected: () => props.selected,
  visible: () => pager.value.visible,
  keyOf,
  emit: (keys) => emit('update:selected', keys),
});

// ── Toolbar ───────────────────────────────────────────────────────────────────────────────────
function onSearch(value: string): void {
  q.value = value;
  if (!props.serverSide) {
    clientPage.value = 0;
    mobileShown.value = 0;
  }
  emit('update:search', value);
}
/** Records only what the person changed against what is painted: a column the box hid and nobody
 *  touched stays the box's to bring back. */
function onColumnsPicked(keys: string[]): void {
  const picked = new Set(keys);
  const shown = new Set(shownColumns.value.map((c) => c.key));
  const choice = new Map(columnChoice.value);
  for (const column of props.columns) {
    if (picked.has(column.key) !== shown.has(column.key)) choice.set(column.key, picked.has(column.key));
  }
  columnChoice.value = choice;
  emit('columnsChange', keys);
}
function onViewPicked(view: DataTableView): void {
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

// ── Infinite scroll ───────────────────────────────────────────────────────────────────────────
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

// ── Row actions ───────────────────────────────────────────────────────────────────────────────
const listActions = (row: T): DataTableActionCell<T> =>
  listRowActions(props.actions, row, { maxInline: props.maxInlineActions, folded: rowActionsCollapsed.value, title: cardTitleOf(row) });
const cardActions = (row: T): DataTableActionCell<T> => cardRowActions(props.actions, row, cardTitleOf(row));
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
        <DataTableToolbar
          :title="title"
          :load-failed="loadFailed"
          :awaiting-rows="awaitingRows"
          :count="pager.count"
          :has-search="hasSearch"
          :search="q"
          :search-placeholder="searchPlaceholder"
          :columns="columns"
          :shown-columns="shownColumns"
          :column-picker="columnPicker"
          :is-mobile="isMobile"
          :page-size-selectable="pageSizeSelectable"
          :page-size="pageSizeNow"
          :page-size-options="pageSizeOptions"
          :view-toggle="viewToggle"
          :view-mode="viewMode"
          :show-funnel="showFunnel"
          :filter-panel-open="filterPanelOpen"
          :filtering="filtering"
          :refused="refused"
          :filter-count="filterCountNow"
          :addable="addable"
          :primary-action="primaryAction"
          :labels="labels"
          :testid="testid?.trim() || undefined"
          @search="onSearch"
          @columns="onColumnsPicked"
          @page-size="setPageSize"
          @view="onViewPicked"
          @filters="toggleFilterPanel"
          @add="emit('add')"
          @primary-action="emit('primaryAction')"
        >
          <template
            v-if="slots.filters"
            #filters
          >
            <slot name="filters" />
          </template>
          <template
            v-if="slots.toolbar"
            #toolbar
          >
            <slot name="toolbar" />
          </template>
        </DataTableToolbar>
        <!-- Column filters: one control per filtered column, in column order. -->
        <DataTableFilterRow
          v-if="filterColumns.length && !filtersFolded"
          :filter-columns="filterColumns"
          :applied="filterValues"
          :controls="filterControls"
          :filtering="filtering"
          :labels="labels"
          :testid="testid?.trim() || undefined"
          @filter="setFilter"
          @clear="clearFilters"
        />
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
        <DataTableGrid
          :visible="pager.visible"
          :rows="rows"
          :columns="listColumns"
          :template="template"
          :x-overflow="xOverflow"
          :sorting="sorting"
          :selectable="selectable"
          :all-selected="allSelected"
          :selection="selection"
          :key-of="keyOf"
          :row-id="rowId"
          :list-actions="listActions"
          :has-actions="hasActions"
          :row-actions-collapsed="rowActionsCollapsed"
          :actions-label-fits="actionsLabelFits"
          :row-clickable="rowClickable"
          :labels="labels"
          :testid="testid?.trim() || undefined"
          @sort="sorting.onHeaderClick"
          @select-all="toggleAll"
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
        </DataTableGrid>
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

/* ── Filters panel (`filterable`) ────────────────────────────────────────────────────────────
   ≥ 834px: while it is open the surface is a grid of TWO columns (list | 360px panel): the list
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

/* ── Cards ───────────────────────────────────────────────────────────────────────────────── */
/* Each card is as tall as its content; rows pack at the top. */
.data-table__cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)); gap: 0.75rem; padding: 1rem; grid-auto-rows: max-content; align-content: start; align-items: stretch; }

.data-table > .data-table__surface {
  border: 1px solid var(--border-color-soft);
}
.data-table > .data-table__surface > .data-table__bar,
.data-table > .data-table__surface > .data-table__pager {
  background: color-mix(in srgb, var(--header-background) 65%, var(--background));
}
</style>

<style>
/* Unscoped: the checkboxes of the list (its head and its rows) and of the cards are painted by DataTableGrid,
   DataTableListItem and DataTableCard, which a scoped rule here does not reach. */
.data-table ion-checkbox { --size: 24px; width: 44px; height: 44px; margin: -10px; display: grid; place-items: center; }
</style>
