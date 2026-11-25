import type { DataTableColumn } from './types';

/** rem a column without its own width keeps when its text is cut, and the ones a name does. */
const COMMON_FLOOR = 5.5;
const NAME_FLOOR = 10;

export interface ColumnFit {
  /** px a column without its own width asks for to hold its content whole, by key (0 = the common floor
   *  holds it; missing = not measured yet). */
  contentWidths?: Readonly<Record<string, number>>;
  /** px of the common floor its content leaves free, by key. */
  spareWidths?: Readonly<Record<string, number>>;
  /** px of a rem. */
  rem?: number;
  /** The row has no room for every column whole: they may cut their text (`'tight'`: a name below its 10rem too). */
  clipped?: boolean | 'tight';
}

/** A column sized by its content, in px: what it keeps, what it asks for and what it has to spare. */
export interface LendingColumn {
  key: string;
  floor: number;
  need: number;
  spare: number;
}

/** The floors, in px, of the columns that lend or take: the short ones give what they have to spare to the ones that
 *  would be cut, each in proportion and no more than is missing. They add up to the same as before, so the list gives
 *  up its low columns, its actions or its rows at the same widths as if nobody lent. PURE. */
export function lentFloors(columns: readonly LendingColumn[]): Record<string, number> {
  const missing = (column: LendingColumn): number => Math.max(0, column.need - column.floor);
  const sum = (px: (column: LendingColumn) => number): number => columns.reduce((total, column) => total + px(column), 0);
  const asked = sum(missing);
  const spare = sum((column) => column.spare);
  const lent = Math.min(asked, spare);
  if (!(lent > 0)) return {};
  const floors: Record<string, number> = {};
  for (const column of columns) {
    const moved = (lent * missing(column)) / asked - (lent * column.spare) / spare;
    if (moved !== 0) floors[column.key] = Math.round((column.floor + moved) * 100) / 100;
  }
  return floors;
}

const isName = <T>(column: DataTableColumn<T>): boolean => !!column.identity || column.priority === 'high';

const needOf = <T>(column: DataTableColumn<T>, fit: ColumnFit): number => fit.contentWidths?.[column.key] ?? 0;

/** The least a column keeps: its own floor, 10rem for a name that is cut and the common floor for the others. */
function floorOf<T>(column: DataTableColumn<T>, fit: ColumnFit): string {
  if (column.minWidth) return column.minWidth;
  const name = isName(column) && fit.contentWidths?.[column.key] !== 0 && fit.clipped !== 'tight';
  return `${name ? NAME_FLOOR : COMMON_FLOOR}rem`;
}

/** A floor in px; `undefined` when it is not written in rem or px. */
function floorPx(floor: string, rem: number): number | undefined {
  const [, length, unit] = /^([\d.]+)(rem|px)$/.exec(floor) ?? [];
  return length === undefined ? undefined : Number(length) * (unit === 'rem' ? rem : 1);
}

/** What a column brings to `lentFloors`. Only a short column of plain text lends: what another one paints wraps or
 *  shrinks when it is squeezed and no longer says its width. One on its own floor (`minWidth`) keeps it. */
function lending<T>(column: DataTableColumn<T>, fit: ColumnFit): LendingColumn | undefined {
  const floor = column.width == null ? floorPx(floorOf(column, fit), fit.rem ?? 16) : undefined;
  if (floor === undefined) return undefined;
  const need = needOf(column, fit);
  const lends = !(need > 0) && !column.minWidth && !column.cell && !column.identity && !column.toggle;
  return {
    key: column.key,
    floor: need > 0 && !column.minWidth ? Math.min(floor, need) : floor,
    need,
    spare: lends ? (fit.spareWidths?.[column.key] ?? 0) : 0,
  };
}

function track<T>(column: DataTableColumn<T>, fit: ColumnFit, lent: number | undefined): string {
  if (column.width != null) return column.width;
  const need = needOf(column, fit);
  const floor = floorOf(column, fit);
  const share = isName(column) ? '1.4fr' : '1fr';
  if (!(need > 0)) return `minmax(${lent === undefined ? floor : `${lent}px`},${share})`;
  if (fit.clipped) {
    if (lent !== undefined) return `minmax(${lent}px,${need}px)`;
    // Never past its content: the widest text gives its width up first.
    const name = floor === `${NAME_FLOOR}rem` && !column.minWidth;
    return `minmax(${name ? `min(${floor},${need}px)` : floor},${need}px)`;
  }
  // Whole while the row has room, sharing what is left.
  return column.minWidth ? `minmax(max(${floor},${need}px),${share})` : `minmax(${need}px,${share})`;
}

/** The grid track of each column of the list, in order. PURE. */
export function columnTracks<T>(columns: readonly DataTableColumn<T>[], fit: ColumnFit): string[] {
  const lent = fit.clipped ? lentFloors(columns.map((column) => lending(column, fit)).filter((column) => column !== undefined)) : {};
  return columns.map((column) => track(column, fit, lent[column.key]));
}
