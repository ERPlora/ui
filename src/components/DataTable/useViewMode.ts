import { onBeforeUnmount, type Ref, ref, watch } from 'vue';

import { type CardsForFitInput, decideCardsForFit } from './fitDecisions';
import type { DataTableView } from './types';

export interface ViewModeSource {
  root: Ref<HTMLElement | null>;
  cardBreakpoint: () => number;
  cardViewEnabled: () => boolean;
  defaultView: () => DataTableView | undefined;
  deps: () => unknown[];
  shape: () => string;
}

const TOOLBAR = ':scope > .data-table__surface > .data-table__bar';

/** The width the rows have. An open filters panel takes its place inside the table's box, beside the toolbar and
 *  the rows, so the toolbar is as wide as they are; without one no panel opens and the room is the box. */
function rowsRoom(root: HTMLElement | null): number {
  return (root?.querySelector<HTMLElement>(TOOLBAR) ?? root)?.clientWidth ?? 0;
}

/** Is the table on a phone (`cardBreakpoint` px wide or less)? */
function usePhoneBreakpoint(source: ViewModeSource, viewMode: Ref<DataTableView>): Ref<boolean> {
  const isMobile = ref(false);
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
  onBeforeUnmount(() => media?.removeEventListener('change', onMediaChange));
  return isMobile;
}

/** The table's list or its cards. `refit` hears of other columns or actions: the fold decision is then taken again. */
export function useViewMode(source: ViewModeSource, write: <V>(target: Ref<V>, value: V) => void, refit: () => void) {
  const viewMode = ref<DataTableView>('table');
  const fitCards = ref(false);
  /** The person picked a view: from then on nothing automatic touches it. */
  let viewChosenByUser = false;
  let fitCardsWidth = 0;
  let fitShape = source.shape();
  const isMobile = usePhoneBreakpoint(source, viewMode);

  /** The starting view, re-judged while the person has not chosen one by hand. */
  function applyInitialView(): void {
    if (viewChosenByUser) return;
    const cards = source.cardViewEnabled();
    if (isMobile.value && cards) viewMode.value = 'cards';
    else if (source.defaultView() === 'cards' && cards) viewMode.value = 'cards';
    else if (fitCards.value && cards) viewMode.value = 'cards';
    else if (source.defaultView() === 'table') viewMode.value = 'table';
  }

  // Other columns/actions need a new measurement, taken in the list; the same ones in a
  // new array (a parent re-render) keep the cards the list already handed over to.
  watch(source.deps, () => {
    refit();
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

  /** Hand the list over to cards when it does not fit even folded, and back. */
  function measureCardsFit(folded: CardsForFitInput['folded']): void {
    const allowed = source.cardViewEnabled() && !viewChosenByUser && !isMobile.value && source.defaultView() !== 'cards';
    const next = decideCardsForFit({
      allowed,
      hostWidth: rowsRoom(source.root.value),
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

  return { viewMode, isMobile, fitCards, setViewMode, measureCardsFit };
}
