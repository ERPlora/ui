import { computed, nextTick, type Ref, ref, watch } from 'vue';

import type { DataTableColumn, DataTableFilters } from './types';
import { useFilterSheet } from './useFilterSheet';

export interface FilterPanelSource<T extends object> {
  /** The table's root element (`.data-table`): the drawer and the funnel are found inside it. */
  root: Ref<HTMLElement | null>;
  filterable: () => boolean;
  /** The table paints cards. */
  cardsOn: () => boolean;
  /** Every filter, as a column (`useColumnFilters`). */
  filterColumns: () => DataTableColumn<T>[];
  setFilters: (filters: DataTableFilters) => void;
}

/** The filters panel (`filterable`): whether the column filters fold behind the funnel, whether the panel is
 *  open, and the focus going into it and back to the funnel. */
export function useFilterPanel<T extends object>(source: FilterPanelSource<T>) {
  /** The column filters live behind the funnel: `filterable`, or the cards (an open row of controls would
   *  take half a phone before the first card). */
  const filtersFolded = computed(() => source.filterable() || source.cardsOn());
  const filterPanelOpen = ref(false);
  const showFunnel = computed(() => filtersFolded.value && source.filterColumns().length > 0);
  // Below 834 px the panel is a sheet over the content area: where that area begins and ends.
  const { sheet: panelIsSheet } = useFilterSheet(() => source.root.value, () => filterPanelOpen.value);

  function openFilterPanel(): void {
    filterPanelOpen.value = true;
    void nextTick(() => source.root.value?.querySelector<HTMLElement>(':scope > .data-table__surface > .data-table__drawer')?.focus());
  }
  /** Closes the panel (its draft is dropped) and gives the focus back to the funnel. */
  function closeFilterPanel(): void {
    if (!filterPanelOpen.value) return;
    filterPanelOpen.value = false;
    void nextTick(() => {
      const funnel = source.root.value?.querySelector<HTMLElement>('.data-table__filter-button');
      // An ion-button does not delegate its focus: its native button takes it.
      (funnel?.shadowRoot?.querySelector<HTMLElement>('button') ?? funnel)?.focus();
    });
  }
  function toggleFilterPanel(): void {
    if (filterPanelOpen.value) closeFilterPanel();
    else openFilterPanel();
  }
  /** «Apply» of the panel: its draft applied, and the panel closed. */
  function applyFilterPanel(draft: DataTableFilters): void {
    source.setFilters(draft);
    closeFilterPanel();
  }
  // Its columns stopped declaring filters, the page dropped `filterable` or the list came back from the
  // cards: nothing left to show (what was applied stays).
  watch(showFunnel, (shown) => {
    if (!shown) filterPanelOpen.value = false;
  });

  return { filtersFolded, filterPanelOpen, showFunnel, panelIsSheet, closeFilterPanel, toggleFilterPanel, applyFilterPanel };
}
