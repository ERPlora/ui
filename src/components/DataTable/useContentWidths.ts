import { type Ref, ref } from 'vue';

import { COMMON_FLOOR } from './columnTracks';
import { columnNeed, columnSpare, nextNeeds, sameNeeds } from './fitDecisions';
import { naturalCellWidth } from './naturalWidth';

export interface ContentWidthsSource {
  /** The box that scrolls the list, `null` while it paints cards. */
  scroll: () => HTMLElement | null;
  /** As in `DataTableLayoutSource`. */
  columnKeys: () => readonly (string | null)[];
  rowsKey: () => string;
  /** Writes what the render reads, when it changes. */
  write: <V>(target: Ref<V>, value: V) => void;
}

const HEAD_CELLS = ':scope > .data-table__grid > .data-table__row--head > [role=columnheader]:not(.data-table__cell--actions)';
const DATA_ROWS = ':scope > .data-table__grid > .data-table__row--data';
const DATA_CELLS = ':scope > [role=cell]:not(.data-table__cell--actions)';

/** The width each measured column takes whole: its header and every row shown, on one line. `null` while they cannot
 *  be read: no list, no width yet, or other columns painted (a render on its way, measured once it lands). */
function naturalWidths(scroll: HTMLElement | null, keys: readonly (string | null)[]): Map<string, number> | null {
  if (!scroll || !(scroll.clientWidth > 0) || !keys.some((key) => key !== null)) return null;
  const headers = [...scroll.querySelectorAll<HTMLElement>(HEAD_CELLS)];
  if (headers.length !== keys.length) return null;
  const rows = [...scroll.querySelectorAll<HTMLElement>(DATA_ROWS)].map((row) => [...row.querySelectorAll<HTMLElement>(DATA_CELLS)]);
  const widths = new Map<string, number>();
  keys.forEach((key, index) => {
    if (key === null) return;
    let natural = naturalCellWidth(headers[index]);
    for (const cells of rows) if (cells[index]) natural = Math.max(natural, naturalCellWidth(cells[index]));
    widths.set(key, natural);
  });
  return widths;
}

const same = (next: Readonly<Record<string, number>>, before: Readonly<Record<string, number>>): boolean =>
  Object.keys(next).every((key) => next[key] === before[key]);

/** What the columns sized by their content ask for and have to spare, measured on screen. */
export function useContentWidths(source: ContentWidthsSource) {
  /** px each column asks for, by key (`columnNeed`; 0 = the common floor holds it). Kept for a column the rung
   *  hides: its text did not change. */
  const contentWidths = ref<Readonly<Record<string, number>>>({});
  /** px of the common floor each column leaves free, by key (`columnSpare`). */
  const spareWidths = ref<Readonly<Record<string, number>>>({});
  /** px of a rem, as measured. */
  const rem = ref(16);
  /** The rows last measured. */
  let measuredRows: string | undefined;

  /** Measures what is on screen. `true` when what a column asks for changed, and the fit has to be judged again. */
  function measure(): boolean {
    const widths = naturalWidths(source.scroll(), source.columnKeys());
    if (!widths) return false;
    source.write(rem, parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);
    const floor = COMMON_FLOOR * rem.value;
    const byColumn = (px: (natural: number, floor: number) => number): Record<string, number> =>
      Object.fromEntries([...widths].map(([key, natural]) => [key, px(natural, floor)]));
    // A pixel counts: a column that lends is as narrow as its text. What the list gives up does not depend on it.
    const spares = byColumn(columnSpare);
    if (!same(spares, spareWidths.value)) source.write(spareWidths, spares);
    const rowsKey = source.rowsKey();
    const needs = nextNeeds(contentWidths.value, byColumn(columnNeed), rowsKey === measuredRows);
    measuredRows = rowsKey;
    if (sameNeeds(needs, contentWidths.value)) return false;
    source.write(contentWidths, needs);
    return true;
  }

  return { contentWidths, spareWidths, rem, measure };
}
