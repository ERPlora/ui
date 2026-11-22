import { computed, ref } from 'vue';

import type { DataTableColumn } from './types';

interface ColumnsSource {
  /** The box hides the yielding columns now (`useDataTableLayout`). */
  lowHidden: () => boolean;
  /** The table paints cards. */
  cardsOn: () => boolean;
  /** The person picked in the column chooser: the keys now checked. */
  picked: (keys: string[]) => void;
}

/** Which columns the table paints: their `hidden`, the person's pick in the column chooser and, in the
 *  list, the `low` ones the box takes away while they do not fit. */
export function useVisibleColumns<T extends object>(props: Readonly<{ columns: DataTableColumn<T>[] }>, source: ColumnsSource) {
  /** The person's pick in the column chooser, per key; untouched columns follow their `hidden`. */
  const columnChoice = ref(new Map<string, boolean>());
  /** Columns the person sees: their `hidden`, unless picked otherwise in the column chooser. */
  const visibleColumns = computed(() => props.columns.filter((c) => columnChoice.value.get(c.key) ?? c.hidden !== true));
  /** Shown columns the box may take away: `low`, and not picked by hand. */
  const yieldingColumns = computed(() =>
    visibleColumns.value.filter((c) => c.priority === 'low' && columnChoice.value.get(c.key) !== true),
  );
  /** The list's columns: the visible ones, minus the yielding ones while the box hides them. */
  const listColumns = computed(() =>
    source.lowHidden() ? visibleColumns.value.filter((c) => !yieldingColumns.value.includes(c)) : visibleColumns.value,
  );
  /** What the column chooser marks: what the current view paints (the cards keep the low columns). */
  const shownColumns = computed(() => (source.cardsOn() ? visibleColumns.value : listColumns.value));

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
    source.picked(keys);
  }

  return { columnChoice, visibleColumns, yieldingColumns, listColumns, shownColumns, onColumnsPicked };
}
