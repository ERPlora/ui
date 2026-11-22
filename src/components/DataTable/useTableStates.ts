import { computed } from 'vue';

import type { DataTableLabelKey } from './types';

interface StatesProps {
  error?: string;
  loading: boolean;
  rows: unknown[];
  hideToolbarWhenEmpty: boolean;
  serverSide: boolean;
  total: number;
  pageSizeChooser: boolean;
  pageSizeOptions: number[];
}

interface StatesSource {
  /** What the search box holds. */
  query: () => string;
  /** A column filter is in use. */
  filtering: () => boolean;
  /** The props ask for a toolbar. */
  hasToolbar: () => boolean;
  /** Pages of the rows (`pager.pages`). */
  pages: () => number;
  label: (key: DataTableLabelKey) => string;
}

/** A text as it reads aloud: case, spacing and the closing full stop aside. */
const asRead = (text: string) => text.trim().replace(/\s+/g, ' ').replace(/[.!…]+$/u, '').toLocaleLowerCase();

/** What the table paints instead of rows (a load in flight, a failure, an empty list) and the chrome that
 *  goes with it: the toolbar and the pager. */
export function useTableStates(props: Readonly<StatesProps>, source: StatesSource) {
  const hasError = computed(() => !!props.error?.trim());
  /** A load in flight with nothing current to show (no rows yet, or only the failure). */
  const awaitingRows = computed(() => props.loading && (props.rows.length === 0 || hasError.value));
  /** The last load failed: rows, «empty» and counts would all be claims about missing data. */
  const loadFailed = computed(() => hasError.value && !awaitingRows.value);
  /** The reason under the title, unless it only repeats the title (pages often hand the same text). */
  const errorReason = computed(() => (asRead(props.error ?? '') === asRead(source.label('loadError')) ? '' : props.error));
  /** `hideToolbarWhenEmpty` and no record at all: loaded, not failed, nothing searched. */
  const bareEmpty = computed(
    () =>
      props.hideToolbarWhenEmpty &&
      !awaitingRows.value &&
      !loadFailed.value &&
      props.rows.length === 0 &&
      (!props.serverSide || props.total === 0) &&
      !source.query().trim() &&
      !source.filtering(),
  );
  const showTopbar = computed(() => source.hasToolbar() && !bareEmpty.value);
  /** The rows-per-page selector exists (toolbar on a desk, else the footer). */
  const pageSizeSelectable = computed(() => props.pageSizeChooser && props.pageSizeOptions.length > 0);
  const showPager = computed(
    () =>
      !loadFailed.value &&
      !bareEmpty.value &&
      (awaitingRows.value
        ? !source.hasToolbar() && pageSizeSelectable.value
        : source.pages() > 1 || props.pageSizeOptions.length > 0),
  );
  /** Rows that exist but are all hidden by the search are not an empty list. */
  const noMatches = computed(() => props.rows.length > 0);

  return { awaitingRows, loadFailed, errorReason, showTopbar, pageSizeSelectable, showPager, noMatches };
}
