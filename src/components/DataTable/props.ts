import type {
  DataTableAction,
  DataTableActionEvent,
  DataTableColumn,
  DataTableEntityLabel,
  DataTableFilterField,
  DataTableFilters,
  DataTableLabels,
  DataTablePrimaryAction,
  DataTableRowKey,
  DataTableSort,
  DataTableSortDir,
  DataTableToggleEvent,
  DataTableView,
} from './types';

/** What a page hands the DataTable. */
export interface DataTableProps<T> {
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
}

/** What the DataTable takes for a prop the page leaves out. */
export const DATA_TABLE_DEFAULTS = {
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
  sortDir: 'asc' as const,
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
};

/** What the DataTable tells the page. */
export type DataTableEmits<T> = {
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
};

type RowSlot<T> = (props: { row: T }) => unknown;
/** A column's `cell` slot (any name a column declares). */
type CellSlot<T> = (props: { row: T; value: unknown; column: DataTableColumn<T> }) => unknown;
/** What the DataTable lets the page paint. */
export type DataTableSlots<T> = {
  /** The page's filters (a status select…): right after the search box. */
  filters?(): unknown;
  toolbar?(): unknown;
  'row-actions'?: RowSlot<T>;
  card?: RowSlot<T>;
  /** Replaces the content of the empty state (the search is the page's, through v-model:search). */
  empty?(): unknown;
  [cell: string]: CellSlot<T> | undefined;
};
