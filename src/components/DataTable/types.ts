// Public types of `DataTable`, the Vue port of OutfitKit's `ok-data-table` (PLAN §16.11).
// Same surface as the Lit original, in Vue idioms: `header` is `label`, `format` also receives the
// cell value, `render`/`renderCard` are slots (`cell`, `card`) and events are Vue emits.
import type en from './locales/en.json';

/** How the rows are presented: a list (CSS grid) or cards. */
export type DataTableView = 'table' | 'cards';

/** Direction of a sort. */
export type DataTableSortDir = 'asc' | 'desc';

/** Payload of `sortChange` (server mode). */
export interface DataTableSort {
  sort: string;
  dir: DataTableSortDir;
}

export interface DataTableColumn<T = Record<string, unknown>> {
  /** Field of the row, or a logical id when `format`/`cell` paint something else. */
  key: string;
  /** Column header. */
  label: string;
  /** Text to paint; receives `row[key]` and the row. Without it the raw value is painted. */
  format?: (value: unknown, row: T) => string;
  /** What a client-side sort compares (outfitkit#256): e.g. a status sorted by rank. Without it a
   *  formatted column compares `row[key]` when it is data (number, boolean, Date, ISO date/time or
   *  numeric string; null last) and the painted text for anything else. */
  sortValue?: (row: T) => unknown;
  /** Alignment of the cell content. */
  align?: 'left' | 'right' | 'center';
  /** Client mode: sortable unless `false`. Server mode: only when `true` (emits `sortChange`). */
  sortable?: boolean;
  /** Name of the scoped slot (`{ row, value, column }`) that paints the cell, list and cards. */
  cell?: string;
  /** Not painted until the person picks it in the column chooser; it still sorts. */
  hidden?: boolean;
  /** CSS track of the column in the list (`8rem`, `minmax(8rem,1fr)`…). Default `minmax(5.5rem,1fr)`. */
  width?: string;
  /** Pins the column to the end edge, like the row actions column. */
  pinned?: 'end';
}

/** A row action label: fixed text, or read from the row (it is also the accessible name). */
export type DataTableActionLabel<T> = string | ((row: T) => string);

export interface DataTableAction<T = Record<string, unknown>> {
  /** Id emitted in `action`. */
  id: string;
  /** Button text, or its accessible name when the action has an icon. */
  label: DataTableActionLabel<T>;
  /** Icon name (`ion:` by default, any baked set). Icon actions are icon-only buttons. */
  icon?: string;
  /** Theme tone (`danger`, `primary`…), painted from its `--ion-color-*` token. Default `medium`. */
  color?: string;
  /** Applies to the row but cannot be taken now: greyed out. */
  disabled?: (row: T) => boolean;
  /** In progress for the row: spinner instead of the icon, and disabled. */
  loading?: (row: T) => boolean;
  /** Does not apply to the row: not rendered (the list keeps an invisible gap of its width). */
  hidden?: (row: T) => boolean;
}

/** Payload of `action`. */
export interface DataTableActionEvent<T = Record<string, unknown>> {
  actionId: string;
  row: T;
}

/** The highlighted button of the toolbar (emits `primaryAction`). */
export interface DataTablePrimaryAction {
  label: string;
  /** Icon name, `add` by default. */
  icon?: string;
}

/** Stable key of a row: one of its fields, or a function of it. */
export type DataTableRowKey<T> = (keyof T & string) | ((row: T) => string);

/** Every human text of the table chrome (`{n}`, `{from}`, `{to}` are filled in by the table). */
export type DataTableLabels = Record<keyof typeof en.dataTable, string>;

export type DataTableLabelKey = keyof DataTableLabels;
