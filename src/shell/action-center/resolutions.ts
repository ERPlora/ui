// What the panel shows when things get solved: a solved notice stays a moment (for its check) before it leaves,
// and when nothing is pending any more «all clear» stays a moment before the panel closes.
import { computed, shallowRef } from 'vue';
import type { ComputedRef, Ref } from 'vue';

import type { ActionNotice } from './types';

export interface LingerOptions {
  /** How long a solved notice stays, in ms. */
  readonly duration: number;
  /** One left by its time, not by coming back. */
  readonly onLeave?: (id: string) => void;
}

export interface Linger {
  /** The solved notices still shown, as they were last seen. */
  readonly items: Readonly<Ref<readonly ActionNotice[]>>;
  readonly ids: ComputedRef<ReadonlySet<string>>;
  add(notices: readonly ActionNotice[]): void;
  /** They came back: they leave now, without waiting for their time. */
  drop(ids: readonly string[]): void;
  clear(): void;
}

export function createLinger(options: LingerOptions): Linger {
  const items = shallowRef<readonly ActionNotice[]>([]);
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  function remove(ids: readonly string[]): void {
    const leaving = new Set(ids.filter((id) => timers.has(id)));
    if (leaving.size === 0) return;
    for (const id of leaving) clearTimeout(timers.get(id));
    for (const id of leaving) timers.delete(id);
    items.value = items.value.filter((notice) => !leaving.has(notice.id));
  }

  function timeUp(id: string): void {
    remove([id]);
    options.onLeave?.(id);
  }

  function add(notices: readonly ActionNotice[]): void {
    if (notices.length === 0) return;
    remove(notices.map((notice) => notice.id));
    items.value = [...items.value, ...notices];
    for (const { id } of notices) timers.set(id, setTimeout(() => timeUp(id), options.duration));
  }

  return {
    items,
    ids: computed(() => new Set(items.value.map((notice) => notice.id))),
    add,
    drop: remove,
    clear: () => remove([...timers.keys()]),
  };
}

export interface AllClearOptions {
  readonly duration: number;
  readonly onDone: () => void;
}

export interface AllClear {
  readonly active: Readonly<Ref<boolean>>;
  start(): void;
  /** Ends it without `onDone`. */
  cancel(): void;
}

export function createAllClear(options: AllClearOptions): AllClear {
  const active = shallowRef(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  function cancel(): void {
    clearTimeout(timer);
    timer = undefined;
    active.value = false;
  }

  function start(): void {
    cancel();
    active.value = true;
    timer = setTimeout(() => {
      cancel();
      options.onDone();
    }, options.duration);
  }

  return { active, start, cancel };
}
