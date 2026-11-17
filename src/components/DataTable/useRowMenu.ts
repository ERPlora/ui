import { computed, ref, shallowRef, watch } from 'vue';

import type { DataTableAction } from './types';

/** The «⋮» menu of a row: which row it is open for, beside which tap, and what it offers now. */
export function useRowMenu<T>(source: {
  rows: () => readonly T[];
  keyOf: (row: T) => string;
  /** What «⋮» offers for the row now: never an action that has its button on screen, so a menu item
   *  can carry the action's hook without it ever being there twice. */
  menuOf: (row: T) => DataTableAction<T>[];
  run: (action: DataTableAction<T>, row: T) => void;
}) {
  const open = ref(false);
  const event = shallowRef<Event>();
  const opened = shallowRef<T>();

  /** The row it is open for, read again by key (its data may have changed). */
  const row = computed(() => {
    const kept = opened.value;
    if (!kept) return undefined;
    const key = source.keyOf(kept);
    return (key ? source.rows().find((each) => source.keyOf(each) === key) : undefined) ?? kept;
  });
  const actions = computed(() => (row.value ? source.menuOf(row.value) : []));
  // The box widened under an open menu and every action is a button again: nothing left to offer.
  watch(
    () => actions.value.length,
    (count) => {
      if (count === 0) open.value = false;
    },
  );

  function openFor(tap: Event, of: T): void {
    tap.stopPropagation();
    event.value = tap;
    opened.value = of;
    open.value = true;
  }
  function pick(action: DataTableAction<T>): void {
    if (!row.value) return;
    open.value = false;
    source.run(action, row.value);
  }

  return { open, event, row, actions, openFor, pick };
}
