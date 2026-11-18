// The state the pieces of the action center share, and what follows from it: the notices in order (the solved
// ones still lingering included), the featured one, the rows, the bell and the card.
import { computed, shallowRef, watch } from 'vue';
import type { ComputedRef, ShallowRef } from 'vue';

import { createActionRunner } from './actions';
import type { ActionRunner } from './actions';
import { createArrivals } from './arrivals';
import type { Arrivals } from './arrivals';
import { sortNotices } from './ordering';
import { createAllClear, createLinger } from './resolutions';
import type { AllClear, Linger } from './resolutions';
import { summarize } from './summary';
import type { BellSummary } from './summary';
import type { ActionNotice } from './types';

const ARRIVAL_MS = 4000;
const RESOLVED_MS = 1200;
const ALL_CLEAR_MS = 1800;

export interface StateOptions {
  /** How long a new notice shows as a card, in ms. */
  readonly arrivalMs?: number;
  /** How long a solved notice stays marked as solved, in ms. */
  readonly resolvedMs?: number;
  /** How long «all clear» shows before the panel closes, in ms. */
  readonly allClearMs?: number;
}

export interface CenterState {
  /** The last result of the source, kept whole while it fails. */
  readonly latest: ShallowRef<readonly ActionNotice[]>;
  /** Grows each time the bell has to pulse. */
  readonly pulse: ShallowRef<number>;
  readonly open: ShallowRef<boolean>;
  /** The notice the user featured; undefined features the first of the order. */
  readonly chosen: ShallowRef<string | undefined>;
  /** The time the countdowns are measured at. */
  readonly time: ShallowRef<number>;
  readonly arrivals: Arrivals;
  readonly linger: Linger;
  readonly allClear: AllClear;
  readonly runner: ActionRunner;
}

export interface CenterView {
  readonly shown: ComputedRef<readonly ActionNotice[]>;
  readonly summary: ComputedRef<BellSummary>;
  readonly featured: ComputedRef<ActionNotice | undefined>;
  readonly rows: ComputedRef<readonly ActionNotice[]>;
  readonly arrival: ComputedRef<ActionNotice | undefined>;
}

export function createState(options: StateOptions): CenterState {
  const pulse = shallowRef(0);
  const open = shallowRef(false);
  return {
    latest: shallowRef([]),
    pulse,
    open,
    chosen: shallowRef(),
    time: shallowRef(0),
    arrivals: createArrivals({ duration: options.arrivalMs ?? ARRIVAL_MS, onSettle: () => pulse.value++ }),
    linger: createLinger({ duration: options.resolvedMs ?? RESOLVED_MS }),
    allClear: createAllClear({ duration: options.allClearMs ?? ALL_CLEAR_MS, onDone: () => (open.value = false) }),
    runner: createActionRunner(),
  };
}

export function createView(state: CenterState): CenterView {
  const shown = computed(() => sortNotices([...state.latest.value, ...state.linger.items.value]));
  const featured = computed(() => shown.value.find((notice) => notice.id === state.chosen.value) ?? shown.value[0]);
  return {
    shown,
    summary: computed(() => summarize(shown.value, state.time.value)),
    featured,
    rows: computed(() => shown.value.filter((notice) => notice !== featured.value)),
    arrival: computed(() => {
      const current = state.arrivals.current.value;
      return current && (state.latest.value.find((notice) => notice.id === current.id) ?? current);
    }),
  };
}

/** Forgets the chosen notice once it is gone, and shows «all clear» when the last one leaves with the panel open. */
export function watchLeaving(state: CenterState, view: CenterView): void {
  watch(
    view.shown,
    (shown) => {
      if (!shown.some((notice) => notice.id === state.chosen.value)) state.chosen.value = undefined;
    },
    { flush: 'sync' },
  );
  watch(
    () => view.summary.value.total,
    (total, before) => {
      if (total > 0) state.allClear.cancel();
      else if (before > 0 && state.open.value) state.allClear.start();
    },
    { flush: 'sync' },
  );
}

/** Back to nothing pending, with the panel closed first so that emptying it is not «all clear». */
export function resetState(state: CenterState): void {
  state.open.value = false;
  state.allClear.cancel();
  state.arrivals.withdraw();
  state.linger.clear();
  state.latest.value = [];
  state.chosen.value = undefined;
}
