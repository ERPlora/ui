// The one action center of the page, as data: the shell connects the source of the notices once, and the
// components that paint the bell, the card and the panel read it and act on it through `useActionCenter()`.
// Nothing here touches the DOM, Ionic or the router.
import { computed, effectScope, getCurrentScope, onScopeDispose, shallowRef, toValue, watch } from 'vue';
import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue';

import type { NoticeActionSlot } from './actions';
import type { ArrivalHold } from './arrivals';
import { createIntake } from './intake';
import type { Intake } from './intake';
import { createState, createView, resetState, watchLeaving } from './state';
import type { CenterState, CenterView, StateOptions } from './state';
import type { ActionNotice, ActionNoticeSource, NoticeDestination, NoticeSeverity } from './types';

const CLOCK_TICK_MS = 60_000;

export interface ActionCenterOptions extends StateOptions {
  /** The clock of the countdowns, read every minute; `Date.now` by default. */
  readonly now?: () => number;
}

/** What the components that paint the action center read and do. */
export interface ActionCenter {
  /** The source has not given its result yet. */
  readonly loading: ComputedRef<boolean>;
  readonly failed: ComputedRef<boolean>;
  retry(): void;
  readonly total: ComputedRef<number>;
  readonly topSeverity: ComputedRef<NoticeSeverity | undefined>;
  readonly mostUrgent: ComputedRef<ActionNotice | undefined>;
  readonly dueProgress: ComputedRef<number | undefined>;
  readonly featured: ComputedRef<ActionNotice | undefined>;
  readonly rows: ComputedRef<readonly ActionNotice[]>;
  /** The ids of the notices just solved, still in the lists for a moment. */
  readonly resolved: ComputedRef<ReadonlySet<string>>;
  readonly allClear: ComputedRef<boolean>;
  readonly open: ComputedRef<boolean>;
  /** The new notice to show as a card under the top bar; undefined once it settles in the bell or leaves. */
  readonly arrival: ComputedRef<ActionNotice | undefined>;
  /** Changes each time the bell has to pulse. */
  readonly pulse: ComputedRef<number>;
  readonly busy: ComputedRef<ReadonlySet<string>>;
  /** Opens the panel featuring `id`, or the first of the order; the card on screen leaves. */
  openPanel(id?: string): void;
  closePanel(): void;
  feature(id: string): void;
  runAction(notice: ActionNotice, which: NoticeActionSlot): Promise<NoticeDestination | undefined>;
  pauseArrival(): void;
  resumeArrival(): void;
  settleArrival(): void;
  holdArrivals(reason: ArrivalHold): void;
  releaseArrivals(reason: ArrivalHold): void;
}

export interface ActionCenterStore {
  readonly center: ActionCenter;
  /** Listens to `source` instead of the one before; gives back how to stop listening to it. */
  connect(source: ActionNoticeSource): () => void;
}

/** Listens to one source at a time, with the clock of the countdowns running while it does. */
function createConnection(state: CenterState, intake: Intake, now: () => number) {
  const source = shallowRef<ActionNoticeSource>();
  let stop: (() => void) | undefined;

  function listen(next: ActionNoticeSource): void {
    const tick = (): void => {
      state.time.value = now();
    };
    tick();
    const timer = setInterval(tick, CLOCK_TICK_MS);
    onScopeDispose(() => clearInterval(timer));
    watch([next.notices, next.failed], ([notices, failed]) => intake.receive(notices, failed), {
      immediate: true,
      flush: 'sync',
    });
  }

  function disconnect(): void {
    stop?.();
    stop = undefined;
    source.value = undefined;
    intake.restart();
    resetState(state);
  }

  function connect(next: ActionNoticeSource): () => void {
    disconnect();
    source.value = next;
    const scope = effectScope(true);
    scope.run(() => listen(next));
    stop = () => scope.stop();
    return () => {
      if (source.value === next) disconnect();
    };
  }

  return { source, connect };
}

function expose(state: CenterState, view: CenterView, source: Readonly<Ref<ActionNoticeSource | undefined>>): ActionCenter {
  const known = (id: string | undefined): string | undefined =>
    view.shown.value.some((notice) => notice.id === id) ? id : undefined;
  const summary = view.summary;
  return {
    loading: computed(() => source.value !== undefined && source.value.notices.value === undefined),
    failed: computed(() => source.value?.failed.value ?? false),
    retry: () => source.value?.retry?.(),
    total: computed(() => summary.value.total),
    topSeverity: computed(() => summary.value.topSeverity),
    mostUrgent: computed(() => summary.value.mostUrgent),
    dueProgress: computed(() => summary.value.dueProgress),
    featured: view.featured,
    rows: view.rows,
    resolved: state.linger.ids,
    allClear: computed(() => state.allClear.active.value),
    open: computed(() => state.open.value),
    arrival: view.arrival,
    pulse: computed(() => state.pulse.value),
    busy: computed(() => state.runner.busy.value),
    openPanel: (id) => {
      state.arrivals.withdraw();
      state.chosen.value = known(id);
      state.open.value = true;
    },
    closePanel: () => {
      state.open.value = false;
      state.allClear.cancel();
    },
    feature: (id) => {
      if (known(id)) state.chosen.value = id;
    },
    runAction: state.runner.run,
    pauseArrival: state.arrivals.pause,
    resumeArrival: state.arrivals.resume,
    settleArrival: state.arrivals.settle,
    holdArrivals: state.arrivals.hold,
    releaseArrivals: state.arrivals.release,
  };
}

export function createActionCenter(options: ActionCenterOptions = {}): ActionCenterStore {
  const state = createState(options);
  const view = createView(state);
  // Detached, so that a component that creates a center does not stop it when it unmounts.
  effectScope(true).run(() => watchLeaving(state, view));
  const connection = createConnection(state, createIntake(state, view), options.now ?? Date.now);
  return { center: expose(state, view, connection.source), connect: connection.connect };
}

const store = createActionCenter();

/** Connects the source of the page's notices; the shell does it once. Gives back how to disconnect it. */
export function connectActionCenter(source: ActionNoticeSource): () => void {
  return store.connect(source);
}

export function useActionCenter(): ActionCenter {
  return store.center;
}

/**
 * While `active`, a new notice does not come as a card over this screen: the bell only pulses. For screens that
 * must not be covered, such as the checkout sheet. Each caller counts apart, and lets go when its scope ends.
 */
export function useQuietActionNotices(active: MaybeRefOrGetter<boolean>): void {
  const reason = Symbol('quiet action notices');
  const { holdArrivals, releaseArrivals } = store.center;
  watch(
    () => toValue(active),
    (quiet) => (quiet ? holdArrivals(reason) : releaseArrivals(reason)),
    { immediate: true, flush: 'sync' },
  );
  if (getCurrentScope()) onScopeDispose(() => releaseArrivals(reason));
}
