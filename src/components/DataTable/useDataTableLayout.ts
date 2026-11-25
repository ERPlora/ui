// Measurements run after render and resize, and write only on change, so none schedules a render loop.
import { computed, nextTick, onBeforeUnmount, onMounted, onUpdated, type Ref, ref } from 'vue';

import { decideFitLevel } from './fitDecisions';
import { ladderLength, type LadderColumn, ladderPhases, ladderRung } from './fitLadder';
import { naturalActionsWidth } from './naturalWidth';
import type { DataTableView } from './types';
import { useContentAfter } from './useContentAfter';
import { useContentWidths } from './useContentWidths';
import { useViewMode } from './useViewMode';

/** What the list gives up, in this order, when it does not fit its box. Only the steps that
 *  change something for the table at hand make its ladder. */
export type DataTableFitStep = 'hideLow' | 'foldAll';

export interface DataTableLayoutSource {
  /** The table's root element (`.data-table`). */
  root: Ref<HTMLElement | null>;
  /** Phone breakpoint in px: at or below it the table behaves as on a phone. */
  cardBreakpoint: () => number;
  /** Are cards available (`views`)? */
  cardViewEnabled: () => boolean;
  defaultView: () => DataTableView | undefined;
  /** Is there a row actions column? */
  hasActions: () => boolean;
  /** The table's ladder, in order. Default: `['foldAll']`, the row actions folded alone. */
  fitSteps?: () => readonly DataTableFitStep[];
  /** The visible columns sized by their content, those a rung hides too: one
   *  that asks for more than its floor (`contentWidths`) makes every rung be tried whole first (`ladderPhases`). */
  clipColumns?: () => readonly LadderColumn[];
  /** The list's columns in the order they are painted: the key of one sized
   *  by its content, `null` for one with its own width (never measured). */
  columnKeys?: () => readonly (string | null)[];
  /** The rows shown, by identity: the same ones refreshed keep what their
   *  columns asked (`nextNeeds`). */
  rowsKey?: () => string;
  /** Identities whose change invalidates the fold decision (columns, actions, choice, selection). */
  deps: () => unknown[];
  /** What the list's width depends on, by content: equal shapes keep the cards. */
  shape: () => string;
  fill: () => boolean;
}

const SCROLL = ':scope > .data-table__surface > .data-table__scroll';
const ACTION_BOXES = '.data-table__row--data > .data-table__cell--actions > .data-table__actions';
const HEAD_ACTIONS = '.data-table__row--head > .data-table__cell--actions';

export function useDataTableLayout(source: DataTableLayoutSource) {
  const xOverflow = ref(false);
  const actionsTrackPx = ref(0);
  const actionsLabelFits = ref(true);
  const scrollEl = (): HTMLElement | null => source.root.value?.querySelector<HTMLElement>(SCROLL) ?? null;
  const { contentWidths, spareWidths, rem, measure: measureContentWidths } = useContentWidths({
    scroll: scrollEl,
    columnKeys: () => source.columnKeys?.() ?? [],
    rowsKey: () => source.rowsKey?.() ?? '',
    write,
  });
  /** Rung of the ladder on screen (0 = the whole list; `ladderRung` reads it). */
  const fitLevel = ref(0);
  const fitSteps = (): readonly DataTableFitStep[] => source.fitSteps?.() ?? ['foldAll'];
  const phases = computed(() => ladderPhases(source.clipColumns?.() ?? [], contentWidths.value));
  const rung = computed(() => ladderRung(fitLevel.value, phases.value));
  /** Is `step` given up right now? */
  const fitApplied = (step: DataTableFitStep): boolean => fitSteps().slice(0, rung.value.base).includes(step);
  /** The columns may cut their text (`'tight'`: the name down to the common floor too): the rung whole did not fit. */
  const columnsClipped = computed(() => rung.value.clipped);
  const lowColumnsHidden = computed(() => fitApplied('hideLow'));
  const rowActionsCollapsed = computed(() => fitApplied('foldAll'));

  let fitDecidedAtWidth = -1;
  /** A state was written that the DOM does not show yet. */
  let renderPending = false;
  let settleQueued = false;

  function write<V>(target: Ref<V>, value: V): void {
    if (target.value === value) return;
    target.value = value;
    renderPending = true;
    settleAfterFlush();
  }

  /** A state the render does not read (the «Actions» label while the actions are folded)
   *  paints nothing, so no `onUpdated` comes to clear `renderPending`: the ladder waited for that
   *  render forever and a folded list that still did not fit never handed over to the cards (the
   *  pinned «⋮» stayed over its last column). Once Vue has flushed, what was written is on screen,
   *  painted or not: measure again from there. */
  function settleAfterFlush(): void {
    if (settleQueued) return;
    settleQueued = true;
    void nextTick(() => {
      settleQueued = false;
      if (renderPending) afterRender();
    });
  }

  const { viewMode, isMobile, fitCards, setViewMode, measureCardsFit } = useViewMode(source, write, () => {
    fitDecidedAtWidth = -1;
  });

  // ── Measurements ──────────────────────────────────────────────────────────────────────────
  const actionBoxes = (): HTMLElement[] => [...(scrollEl()?.querySelectorAll<HTMLElement>(ACTION_BOXES) ?? [])];

  /** Does the list overflow sideways? Only then is the pinned column's shadow painted. */
  function measureXOverflow(): void {
    const scroll = scrollEl();
    write(xOverflow, !!scroll && scroll.scrollWidth > scroll.clientWidth);
  }

  /** Natural width of the widest row's buttons (they never shrink: `flex: 0 0 auto`). */
  function measureActionsTrack(): void {
    if (!source.hasActions()) {
      write(actionsTrackPx, 0);
      return;
    }
    let width = 0;
    for (const box of actionBoxes()) width = Math.max(width, Math.ceil(Math.max(box.scrollWidth, naturalActionsWidth(box))));
    // 0 = not laid out yet (or cards): keep `max-content` and measure again.
    if (width > 0) write(actionsTrackPx, width);
  }

  /** Does the «Actions» label fit its column, or would it be painted «ACCI…»? */
  function measureActionsLabel(): void {
    const cell = scrollEl()?.querySelector<HTMLElement>(HEAD_ACTIONS);
    const label = cell?.querySelector('span');
    if (!cell || !label) return;
    const need = Math.ceil(label.scrollWidth);
    if (need <= 0 || cell.clientWidth <= 0) return;
    const style = getComputedStyle(cell);
    const room = cell.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
    write(actionsLabelFits, need <= room);
  }

  /** Is there a pinned column over the data, and does its track hold what it shows? A track
   *  still pinned to the unfolded buttons is not the folded list's minimum. What a box shows is
   *  its buttons side by side (a folded row may keep a pinned button AND its «⋮»). */
  function pinnedTrackIsHonest(): boolean {
    const boxes = actionBoxes();
    if (!boxes.length) return false;
    if (actionsTrackPx.value === 0) return true;
    let natural = 0;
    for (const box of boxes) natural = Math.max(natural, naturalActionsWidth(box));
    return natural >= actionsTrackPx.value - 1;
  }

  /** Climbs or restarts the ladder, then hands the list over to cards (or back) from what is on screen. */
  function measureRowActionsFit(): void {
    const scroll = scrollEl();
    if (!scroll) {
      measureCardsFit(null);
      return;
    }
    const containerWidth = scroll.clientWidth;
    const contentWidth = scroll.scrollWidth;
    const steps = ladderLength(fitSteps().length, phases.value);
    const atTop = fitLevel.value >= steps;
    const foldedOnScreen = atTop && fitDecidedAtWidth === containerWidth && !renderPending && pinnedTrackIsHonest();
    const next = decideFitLevel({
      containerWidth,
      contentWidth,
      level: Math.min(fitLevel.value, steps),
      steps,
      decidedAtWidth: fitDecidedAtWidth,
      settled: !renderPending,
    });
    fitDecidedAtWidth = next.decidedAtWidth;
    write(fitLevel, next.level);
    measureCardsFit(foldedOnScreen && next.level >= steps ? { containerWidth, contentWidth } : null);
  }

  const { contentAfter, syncContentAfter, observeSiblings } = useContentAfter(source, write);

  // ── Observers and the measurement pass ──────────────────────────────────────────────────────
  let hostObserver: ResizeObserver | undefined;
  let scrollObserver: ResizeObserver | undefined;

  /** Observe the current scroller and its grid; Ionic may give it its width after hydration. */
  function observeScroll(): void {
    if (typeof ResizeObserver === 'undefined') return;
    const scroll = scrollEl();
    scrollObserver ??= new ResizeObserver(() => {
      measureXOverflow();
      measureActionsTrack();
      measureRowActionsFit();
    });
    scrollObserver.disconnect();
    if (!scroll) return;
    scrollObserver.observe(scroll);
    const grid = scroll.querySelector(':scope > .data-table__grid');
    if (grid) scrollObserver.observe(grid);
  }

  function afterRender(): void {
    renderPending = false;
    observeScroll();
    measureXOverflow();
    measureActionsTrack();
    measureActionsLabel();
    // Other needs: the ladder is judged again from the start once they are on screen (the rung on screen was decided
    // for other columns: shorter rows may fit whole again).
    if (measureContentWidths()) fitDecidedAtWidth = -1;
    else measureRowActionsFit();
  }

  const onWindowResize = (): void => {
    measureXOverflow();
    measureRowActionsFit();
    syncContentAfter();
  };

  onMounted(() => {
    // In cards there is no list to observe: the host says when the box changes; a render, when the filters panel does.
    if (typeof ResizeObserver !== 'undefined' && source.root.value) {
      hostObserver = new ResizeObserver(() => measureRowActionsFit());
      hostObserver.observe(source.root.value);
    }
    window.addEventListener('resize', onWindowResize);
    observeSiblings();
    afterRender();
  });
  onUpdated(afterRender);
  onBeforeUnmount(() => {
    window.removeEventListener('resize', onWindowResize);
    hostObserver?.disconnect();
    scrollObserver?.disconnect();
  });

  return {
    viewMode,
    setViewMode,
    isMobile,
    xOverflow,
    actionsTrackPx,
    actionsLabelFits,
    rowActionsCollapsed,
    lowColumnsHidden,
    columnsClipped,
    contentWidths,
    spareWidths,
    rem,
    fitCards,
    contentAfter,
  };
}
