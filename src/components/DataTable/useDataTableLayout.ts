// Layout decisions of the DataTable, ported 1:1 from OutfitKit's `ok-data-table.ts` (issue numbers
// are ERPlora/outfitkit unless stated otherwise):
//   - card/table switch: phone breakpoint (#274), `defaultView`, the person's own choice;
//   - #67  horizontal overflow of the list (shadow of the pinned column);
//   - #121 the actions track pinned to the MEASURED width of the row buttons;
//   - #211 the «Actions» header painted only when it fits its column;
//   - #122 the row actions folded into a «…» menu when the columns leave them no room;
//   - W-19 (ERPlora UX-AUDIT-3) the same, as a LADDER judged by the table's own box: the `low`
//     columns go first, then the actions beyond `maxInlineActions`, then all but the pinned ones;
//   - #267 the list handed over to cards when it does not fit even folded;
//   - FIX-UI-DATATABLE-EMAIL-COLUMN-834 (erplora-next) each rung of that ladder tried first with every column
//     holding its content whole, and only then with the widest text cut;
//   - #218 `fill`: is there content in flow after the table?
// Everything measured runs after each render and on resize, and only writes a state when it
// CHANGES, so a measurement never schedules a render loop.
import { computed, nextTick, onBeforeUnmount, onMounted, onUpdated, type Ref, ref, watch } from 'vue';

import type { DataTableView } from './types';

/** Input of `decideRowActionsFit`: what gets measured of the hole the table lives in. */
export interface RowActionsFitInput {
  /** Visible width of the scrolling container (`clientWidth`). */
  containerWidth: number;
  /** Width the grid needs right now (`scrollWidth`: its minimum when it overflows). */
  contentWidth: number;
  /** Are the row actions folded into the «…» menu right now? */
  collapsed: boolean;
  /** Container width the current decision was taken at (`-1` = none yet). */
  decidedAtWidth: number;
}

export interface RowActionsFitDecision {
  collapsed: boolean;
  decidedAtWidth: number;
}

/** W-19 - What the list gives up, in this order, when it does not fit its box. Only the steps that
 *  change something for the table at hand make its ladder. */
export type DataTableFitStep = 'hideLow' | 'foldExtra' | 'foldAll';

/** Input of `decideFitLevel`. */
export interface FitLevelInput {
  /** Visible width of the scrolling container (`clientWidth`). */
  containerWidth: number;
  /** Width the grid needs right now (`scrollWidth`: its minimum when it overflows). */
  contentWidth: number;
  /** Steps of the ladder applied right now (0 = none). */
  level: number;
  /** How many steps the table's ladder has. */
  steps: number;
  /** Container width the current decision was taken at (`-1` = none yet). */
  decidedAtWidth: number;
  /** The screen shows `level` (nothing written since the last render): the measurement is of it. */
  settled: boolean;
}

export interface FitLevelDecision {
  level: number;
  decidedAtWidth: number;
}

/**
 * W-19 - How many steps of the ladder (`DataTableFitStep`) the list needs to fit its box. Decided by
 * MEASURING, one step per measurement of what is on screen: what a step frees is only known once it
 * is painted. PURE, and it never oscillates: while the box keeps its width the level only goes up,
 * and only from a settled measurement (never twice from the same stale one). A box that changes
 * width is judged from scratch, with nothing given up; in ONE pass when nothing is (`contentWidth`
 * is then that very measurement).
 */
export function decideFitLevel(input: FitLevelInput): FitLevelDecision {
  const { containerWidth, contentWidth, level, steps, decidedAtWidth, settled } = input;
  // No width, no measurement: inside `ion-content` the hole is 0 wide until Ionic hydrates.
  if (!(containerWidth > 0)) return { level, decidedAtWidth };
  const overflows = contentWidth > containerWidth;
  if (containerWidth !== decidedAtWidth) {
    if (level > 0) return { level: 0, decidedAtWidth: containerWidth };
    return { level: overflows && steps > 0 ? 1 : 0, decidedAtWidth: containerWidth };
  }
  if (settled && overflows && level < steps) return { level: level + 1, decidedAtWidth };
  return { level, decidedAtWidth };
}

/**
 * #122 - Do the row action buttons fit, or do they fold into the «…» menu? The one-step ladder of
 * `decideFitLevel`: folding narrows the grid, which fires the observer again; `decidedAtWidth`
 * makes the state move once at most while the hole keeps its size. A hole that changes size is
 * judged from scratch with the buttons out, in ONE pass when they already are out.
 */
export function decideRowActionsFit(input: RowActionsFitInput): RowActionsFitDecision {
  const { containerWidth, contentWidth, collapsed, decidedAtWidth } = input;
  const next = decideFitLevel({ containerWidth, contentWidth, level: collapsed ? 1 : 0, steps: 1, decidedAtWidth, settled: true });
  return { collapsed: next.level > 0, decidedAtWidth: next.decidedAtWidth };
}

/** FIX-UI-DATATABLE-EMAIL-COLUMN-834 - A rung of the ladder: how many of its steps are given up (`base`) and
 *  whether the columns may cut their text to fit (`clipped`). With `clip` (a column needs more than its floor)
 *  every step is first tried with each column whole, then cut: whole, cut, step 1 whole, step 1 cut… Without
 *  it the ladder is the one of before and nothing is held whole. PURE. */
export function ladderRung(level: number, clip: boolean): { base: number; clipped: boolean } {
  return clip ? { base: Math.floor(level / 2), clipped: level % 2 === 1 } : { base: level, clipped: false };
}

/** FIX-UI-DATATABLE-EMAIL-COLUMN-834 - The top rung of a ladder of `steps` steps (see `ladderRung`). */
export function ladderLength(steps: number, clip: boolean): number {
  return clip ? 2 * steps + 1 : steps;
}

/** FIX-UI-DATATABLE-EMAIL-COLUMN-834 - The px a column asks for to hold its content whole: nothing while its
 *  floor holds it; beyond, its measured width rounded up, plus a pixel of slack for subpixel text. PURE. */
export function columnNeed(natural: number, floor: number): number {
  return natural > floor ? Math.ceil(natural) + 1 : 0;
}

/** Input of `decideCardsForFit`. */
export interface CardsForFitInput {
  /** Cards are declared and nothing else owns the view (no choice by hand, no phone, no
   *  `defaultView="cards"`). */
  allowed: boolean;
  /** Width of the table's own box, in px (`0` = not laid out yet). */
  hostWidth: number;
  /** The list measured FOLDED with the fold decision settled at this width; `null` otherwise. */
  folded: { containerWidth: number; contentWidth: number } | null;
  /** The list is showing cards because it did not fit. */
  fitCards: boolean;
  /** Host width from which the list fits again (meaningful while `fitCards`). */
  fitWidth: number;
}

export interface CardsForFitDecision {
  fitCards: boolean;
  fitWidth: number;
}

/**
 * #267 - The list does not fit its hole even with the row actions folded: hand over to the cards.
 * PURE, and it never oscillates: in cards the list cannot be measured, so the width it needs is
 * remembered (host width + overflow) and the list only comes back once the host reaches it.
 */
export function decideCardsForFit(input: CardsForFitInput): CardsForFitDecision {
  const { allowed, hostWidth, folded, fitCards, fitWidth } = input;
  const idle = { fitCards: false, fitWidth: 0 };
  if (!allowed) return idle;
  if (!(hostWidth > 0)) return { fitCards, fitWidth };
  if (fitCards) return hostWidth >= fitWidth ? idle : { fitCards, fitWidth };
  if (folded && folded.containerWidth > 0 && folded.contentWidth > folded.containerWidth) {
    return { fitCards: true, fitWidth: hostWidth + folded.contentWidth - folded.containerWidth };
  }
  return idle;
}

export interface DataTableLayoutSource {
  /** The table's root element (`.data-table`, the host of the Lit original). */
  root: Ref<HTMLElement | null>;
  /** Phone breakpoint in px: at or below it the table behaves as on a phone. */
  cardBreakpoint: () => number;
  /** Are cards available (`views`)? */
  cardViewEnabled: () => boolean;
  defaultView: () => DataTableView | undefined;
  /** Is there a row actions column? */
  hasActions: () => boolean;
  /** W-19 - The table's ladder, in order. Default: `['foldAll']` (the #122 fold alone). */
  fitSteps?: () => readonly DataTableFitStep[];
  /** FIX-UI-DATATABLE-EMAIL-COLUMN-834 - The visible columns sized by their content, those a rung hides too: one
   *  that asks for more than its floor (`contentWidths`) makes every rung be tried whole first (`ladderRung`). */
  clipKeys?: () => readonly string[];
  /** FIX-UI-DATATABLE-EMAIL-COLUMN-834 - The list's columns in the order they are painted: the key of one sized
   *  by its content, `null` for one with its own width (never measured). */
  columnKeys?: () => readonly (string | null)[];
  /** Identities whose change invalidates the fold decision (columns, actions, choice, selection). */
  deps: () => unknown[];
  /** What the list's width depends on, by content (#267): equal shapes keep the cards. */
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
  const viewMode = ref<DataTableView>('table');
  const isMobile = ref(false);
  const xOverflow = ref(false);
  const actionsTrackPx = ref(0);
  const actionsLabelFits = ref(true);
  /** FIX-UI-DATATABLE-EMAIL-COLUMN-834 - px each column sized by its content asks for, by key (`columnNeed`;
   *  0 = its floor holds it). Kept for a column the rung hides: its text did not change. */
  const contentWidths = ref<Readonly<Record<string, number>>>({});
  /** W-19 - Rung of the ladder on screen (0 = the whole list; `ladderRung` reads it). */
  const fitLevel = ref(0);
  const fitSteps = (): readonly DataTableFitStep[] => source.fitSteps?.() ?? ['foldAll'];
  const clip = computed(() => (source.clipKeys?.() ?? []).some((key) => (contentWidths.value[key] ?? 0) > 0));
  const rung = computed(() => ladderRung(fitLevel.value, clip.value));
  /** Is `step` given up right now? */
  const fitApplied = (step: DataTableFitStep): boolean => fitSteps().slice(0, rung.value.base).includes(step);
  /** FIX-UI-DATATABLE-EMAIL-COLUMN-834 - The columns may cut their text: the rung whole did not fit. */
  const columnsClipped = computed(() => rung.value.clipped);
  const lowColumnsHidden = computed(() => fitApplied('hideLow'));
  const extraActionsFolded = computed(() => fitApplied('foldExtra'));
  const rowActionsCollapsed = computed(() => fitApplied('foldAll'));
  const fitCards = ref(false);
  const contentAfter = ref(false);

  /** The person picked a view: from then on nothing automatic touches it. */
  let viewChosenByUser = false;
  let fitDecidedAtWidth = -1;
  let fitCardsWidth = 0;
  let fitShape = source.shape();
  /** A state was written that the DOM does not show yet (Lit's `isUpdatePending`). */
  let renderPending = false;
  let settleQueued = false;

  function write<V>(target: Ref<V>, value: V): void {
    if (target.value === value) return;
    target.value = value;
    renderPending = true;
    settleAfterFlush();
  }

  /** hub#94 - A state the render does not read (the «Actions» label while the actions are folded)
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

  // ── Phone breakpoint (#274) ─────────────────────────────────────────────────────────────────
  let media: MediaQueryList | undefined;
  const onMediaChange = (e: MediaQueryListEvent | { matches: boolean }): void => {
    const matches = 'matches' in e ? e.matches : (media?.matches ?? false);
    if (isMobile.value === matches) return;
    isMobile.value = matches;
    // Crossing to a phone (cards available) → cards; back to a desk → the list.
    if (matches && source.cardViewEnabled()) viewMode.value = 'cards';
    else if (!matches && viewMode.value === 'cards') viewMode.value = 'table';
  };
  function watchMedia(): void {
    media?.removeEventListener('change', onMediaChange);
    media = undefined;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    media = window.matchMedia(`(max-width: ${source.cardBreakpoint()}px)`);
    isMobile.value = media.matches;
    media.addEventListener('change', onMediaChange);
  }
  watchMedia();
  watch(source.cardBreakpoint, watchMedia);

  /** The starting view, re-judged while the person has not chosen one by hand. */
  function applyInitialView(): void {
    if (viewChosenByUser) return;
    const cards = source.cardViewEnabled();
    if (isMobile.value && cards) viewMode.value = 'cards';
    else if (source.defaultView() === 'cards' && cards) viewMode.value = 'cards';
    else if (fitCards.value && cards) viewMode.value = 'cards'; // #267
    else if (source.defaultView() === 'table') viewMode.value = 'table';
  }

  // #122/#267 - Other columns/actions need a new measurement, taken in the list; the same ones in a
  // new array (a parent re-render) keep the cards the list already handed over to.
  watch(source.deps, () => {
    fitDecidedAtWidth = -1;
    const shape = source.shape();
    if (shape === fitShape) return;
    fitShape = shape;
    if (fitCards.value) {
      fitCards.value = false;
      fitCardsWidth = 0;
      if (!viewChosenByUser) viewMode.value = 'table';
    }
  });
  watch([isMobile, source.cardViewEnabled, source.defaultView, fitCards], applyInitialView, { immediate: true });

  /** The person's own choice of view. `true` when it changed what is shown. */
  function setViewMode(mode: DataTableView): boolean {
    viewChosenByUser = true;
    if (viewMode.value === mode) return false;
    viewMode.value = mode;
    return true;
  }

  // ── Measurements ──────────────────────────────────────────────────────────────────────────
  const scrollEl = (): HTMLElement | null => source.root.value?.querySelector<HTMLElement>(SCROLL) ?? null;
  const actionBoxes = (): HTMLElement[] => [...(scrollEl()?.querySelectorAll<HTMLElement>(ACTION_BOXES) ?? [])];

  /** #67 - Does the list overflow sideways? Only then is the pinned column's shadow painted. */
  function measureXOverflow(): void {
    const scroll = scrollEl();
    write(xOverflow, !!scroll && scroll.scrollWidth > scroll.clientWidth);
  }

  /** Width an element takes in a row: its box plus its inline margins. */
  const outerWidth = (el: Element): number => {
    const style = getComputedStyle(el);
    return el.getBoundingClientRect().width + (parseFloat(style.marginLeft) || 0) + (parseFloat(style.marginRight) || 0);
  };

  /** The buttons of an actions box side by side: their widths, the gaps between them and the box's
   *  own inline padding. Not the box's `scrollWidth` alone: the box packs its buttons to the END
   *  (`justify-content: flex-end`), so what does not fit overflows towards the inline-START, which
   *  `scrollWidth` never counts — the track stayed at the box's width and labelled buttons covered
   *  the column before them (SaaS Billing at 1440px). */
  function naturalActionsWidth(box: HTMLElement): number {
    return sideBySide(box, outerWidth);
  }

  /** The children of a box side by side: `widthOf` each, the gaps between them and the box's inline padding. */
  function sideBySide(box: HTMLElement, widthOf: (child: Element) => number): number {
    const style = getComputedStyle(box);
    let sum = 0;
    let laidOut = 0;
    for (const child of Array.from(box.children)) {
      const width = widthOf(child);
      if (width <= 0) continue;
      sum += width;
      laidOut += 1;
    }
    if (laidOut === 0) return 0;
    const gap = parseFloat(style.columnGap) || 0;
    return sum + gap * (laidOut - 1) + (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
  }

  /** FIX-UI-DATATABLE-EMAIL-COLUMN-834 - Width a cell's content takes on one line: a text its box cuts counts
   *  whole (`scrollWidth`), whatever the column is given right now. */
  const naturalCellWidth = (cell: HTMLElement): number =>
    sideBySide(cell, (child) => outerWidth(child) + Math.max(0, child.scrollWidth - child.getBoundingClientRect().width));

  /** FIX-UI-DATATABLE-EMAIL-COLUMN-834 - What each column sized by its content asks for: its header and every
   *  row shown, on one line. Written only when it changes, and then the ladder is judged again from the start
   *  (the rung on screen was decided for other columns). `true` when it wrote. */
  function measureContentWidths(): boolean {
    const scroll = scrollEl();
    const keys = source.columnKeys?.() ?? [];
    if (!scroll || !(scroll.clientWidth > 0) || !keys.some((key) => key !== null)) return false;
    // #217 - An unfolded cell wraps to its column: what it needs on one line was measured before the tap.
    if (scroll.querySelector('.data-table__text--unfolded')) return false;
    const headers = [...scroll.querySelectorAll<HTMLElement>(HEAD_CELLS)];
    // Painted from other columns (a render on its way): measured once it lands.
    if (headers.length !== keys.length) return false;
    const rows = [...scroll.querySelectorAll<HTMLElement>(DATA_ROWS)].map((row) => [...row.querySelectorAll<HTMLElement>(DATA_CELLS)]);
    const floor = 5.5 * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);
    const next: Record<string, number> = { ...contentWidths.value };
    keys.forEach((key, index) => {
      if (key === null) return;
      let natural = naturalCellWidth(headers[index]);
      for (const cells of rows) if (cells[index]) natural = Math.max(natural, naturalCellWidth(cells[index]));
      next[key] = columnNeed(natural, floor);
    });
    const before = contentWidths.value;
    if (Object.keys(next).every((key) => next[key] === before[key])) return false;
    fitDecidedAtWidth = -1;
    write(contentWidths, next);
    return true;
  }

  /** #121 - Natural width of the widest row's buttons (they never shrink: `flex: 0 0 auto`). */
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

  /** #211 - Does the «Actions» label fit its column, or would it be painted «ACCI…»? */
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

  /** #267 - Is there a pinned column over the data, and does its track hold what it shows? A track
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

  /** #122/W-19 - Climb or restart the ladder; then #267 on what is on screen. */
  function measureRowActionsFit(): void {
    const scroll = scrollEl();
    if (!scroll) {
      measureCardsFit(null);
      return;
    }
    const containerWidth = scroll.clientWidth;
    const contentWidth = scroll.scrollWidth;
    const steps = ladderLength(fitSteps().length, clip.value);
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

  /** #267 - Hand the list over to cards when it does not fit even folded, and back. */
  function measureCardsFit(folded: CardsForFitInput['folded']): void {
    const allowed = source.cardViewEnabled() && !viewChosenByUser && !isMobile.value && source.defaultView() !== 'cards';
    const next = decideCardsForFit({
      allowed,
      hostWidth: source.root.value?.clientWidth ?? 0,
      folded,
      fitCards: fitCards.value,
      fitWidth: fitCardsWidth,
    });
    fitCardsWidth = next.fitWidth;
    if (next.fitCards === fitCards.value) return;
    write(fitCards, next.fitCards);
    if (next.fitCards) viewMode.value = 'cards';
    else if (allowed) viewMode.value = 'table';
  }

  // ── #218 fill: content in flow after the table ──────────────────────────────────────────────
  let siblingsObserver: MutationObserver | undefined;

  /** Marks `contentAfter` while an element in flow follows the table in its parent. */
  function syncContentAfter(): void {
    let after = false;
    const root = source.root.value;
    if (source.fill() && root) {
      for (let el = root.nextElementSibling; el; el = el.nextElementSibling) {
        const style = getComputedStyle(el);
        if (style.display !== 'none' && style.position !== 'absolute' && style.position !== 'fixed') {
          after = true;
          break;
        }
      }
    }
    write(contentAfter, after);
  }

  /** Watches the parent: children added/removed and a sibling shown or hidden. */
  function observeSiblings(): void {
    siblingsObserver?.disconnect();
    siblingsObserver = undefined;
    const root = source.root.value;
    const parent = root?.parentNode;
    if (source.fill() && root && parent && typeof MutationObserver !== 'undefined') {
      siblingsObserver = new MutationObserver((records) => {
        if (records.some((r) => r.target === parent || (r.target !== root && r.target.parentNode === parent))) {
          syncContentAfter();
        }
      });
      siblingsObserver.observe(parent, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'style', 'class'] });
    }
    syncContentAfter();
  }
  watch(source.fill, observeSiblings, { flush: 'post' });

  // ── Observers and the measurement pass ──────────────────────────────────────────────────────
  let hostObserver: ResizeObserver | undefined;
  let scrollObserver: ResizeObserver | undefined;

  /** The scroller changes between views: observe the current one and its grid. Inside
   *  `ion-content` the hole only gets its width after Ionic hydrates (#67). */
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
    // FIX-UI-DATATABLE-EMAIL-COLUMN-834 - New widths repaint the columns: the ladder measures what they paint.
    if (measureContentWidths()) return;
    measureRowActionsFit();
  }

  const onWindowResize = (): void => {
    measureXOverflow();
    measureRowActionsFit();
    syncContentAfter();
  };

  onMounted(() => {
    // #267 - In cards there is no list to observe: the host's own width says when it fits again.
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
    media?.removeEventListener('change', onMediaChange);
    hostObserver?.disconnect();
    scrollObserver?.disconnect();
    siblingsObserver?.disconnect();
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
    extraActionsFolded,
    columnsClipped,
    contentWidths,
    fitCards,
    contentAfter,
  };
}
