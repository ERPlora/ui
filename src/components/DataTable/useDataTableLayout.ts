// Measurements run after render and resize, and write only on change, so none schedules a render loop.
import { computed, nextTick, onBeforeUnmount, onMounted, onUpdated, type Ref, ref } from 'vue';

import { columnNeed, decideFitLevel, nextNeeds, sameNeeds } from './fitDecisions';
import { ladderLength, type LadderColumn, ladderPhases, ladderRung } from './fitLadder';
import { fitWholeRows } from './fitWholeRows';
import { naturalActionsWidth, naturalCellWidth } from './naturalWidth';
import type { DataTableView } from './types';
import { useContentAfter } from './useContentAfter';
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
const HEAD_CELLS = ':scope > .data-table__grid > .data-table__row--head > [role=columnheader]:not(.data-table__cell--actions)';
const DATA_ROWS = ':scope > .data-table__grid > .data-table__row--data';
const DATA_CELLS = ':scope > [role=cell]:not(.data-table__cell--actions)';
const ACTION_BOXES = '.data-table__row--data > .data-table__cell--actions > .data-table__actions';
const HEAD_ACTIONS = '.data-table__row--head > .data-table__cell--actions';

export function useDataTableLayout(source: DataTableLayoutSource) {
  const xOverflow = ref(false);
  const actionsTrackPx = ref(0);
  const actionsLabelFits = ref(true);
  /** px each column sized by its content asks for, by key (`columnNeed`;
   *  0 = its floor holds it). Kept for a column the rung hides: its text did not change. */
  const contentWidths = ref<Readonly<Record<string, number>>>({});
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
  /** The rows `contentWidths` was last measured on. */
  let measuredRows: string | undefined;
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
  const scrollEl = (): HTMLElement | null => source.root.value?.querySelector<HTMLElement>(SCROLL) ?? null;
  const actionBoxes = (): HTMLElement[] => [...(scrollEl()?.querySelectorAll<HTMLElement>(ACTION_BOXES) ?? [])];

  /** Does the list overflow sideways? Only then is the pinned column's shadow painted. */
  function measureXOverflow(): void {
    const scroll = scrollEl();
    write(xOverflow, !!scroll && scroll.scrollWidth > scroll.clientWidth);
  }

  /** What each column sized by its content asks for: its header and every row shown, on one line. Written only
   *  when it changes (`true`), and then the ladder is judged again from the start once the new needs are on screen
   *  (the rung on screen was decided for other columns: shorter rows may fit whole again). */
  function measureContentWidths(): boolean {
    const scroll = scrollEl();
    const keys = source.columnKeys?.() ?? [];
    if (!scroll || !(scroll.clientWidth > 0) || !keys.some((key) => key !== null)) return false;
    const headers = [...scroll.querySelectorAll<HTMLElement>(HEAD_CELLS)];
    // Painted from other columns (a render on its way): measured once it lands.
    if (headers.length !== keys.length) return false;
    const rows = [...scroll.querySelectorAll<HTMLElement>(DATA_ROWS)].map((row) => [...row.querySelectorAll<HTMLElement>(DATA_CELLS)]);
    const floor = 5.5 * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);
    const measured: Record<string, number> = {};
    keys.forEach((key, index) => {
      if (key === null) return;
      let natural = naturalCellWidth(headers[index]);
      for (const cells of rows) if (cells[index]) natural = Math.max(natural, naturalCellWidth(cells[index]));
      measured[key] = columnNeed(natural, floor);
    });
    const rowsKey = source.rowsKey?.() ?? '';
    const next = nextNeeds(contentWidths.value, measured, rowsKey === measuredRows);
    measuredRows = rowsKey;
    if (sameNeeds(next, contentWidths.value)) return false;
    fitDecidedAtWidth = -1;
    write(contentWidths, next);
    return true;
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
      fitWholeRows(scrollEl(), source.fill() && !isMobile.value);
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
    if (!measureContentWidths()) measureRowActionsFit();
    fitWholeRows(scrollEl(), source.fill() && !isMobile.value);
  }

  const onWindowResize = (): void => {
    measureXOverflow();
    measureRowActionsFit();
    fitWholeRows(scrollEl(), source.fill() && !isMobile.value);
    syncContentAfter();
  };

  onMounted(() => {
    // In cards there is no list to observe: the host's own width says when it fits again.
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
    fitCards,
    contentAfter,
  };
}
