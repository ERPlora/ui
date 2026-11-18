import { ref, watch } from 'vue';

import type { DataTableAction, DataTableActionCell, DataTableColumn, DataTableToggleEvent } from './types';

/** What a data row takes, whether the list paints it as a row of the grid or as a card. */
export interface DataRowProps<T> {
  row: T;
  rows?: T[];
  rowId: string;
  actions: DataTableActionCell<T>;
  selectable?: boolean;
  selected?: boolean;
  clickable?: boolean;
  hasActions?: boolean;
  selectLabel?: string;
  moreLabel?: string;
  testid?: string;
}

export const DATA_ROW_DEFAULTS = {
  rows: undefined,
  selectable: false,
  selected: false,
  clickable: false,
  hasActions: false,
  selectLabel: 'Select',
  moreLabel: 'More actions',
  testid: undefined,
};

export type DataRowEmits<T> = {
  open: [row: T];
  select: [key: string];
  action: [payload: { action: DataTableAction<T>; row: T }];
  menu: [event: Event, row: T];
  toggle: [payload: DataTableToggleEvent<T>];
};

/**
 * How a data row answers the person: a clickable one opens on a click, Enter or Space; on one that is not, a
 * touch on a clipped text unfolds it in place, until the row or the page changes.
 */
export function useDataRow<T extends object>(
  props: Readonly<{ row: T; rows?: T[]; rowId: string; clickable: boolean }>,
  onOpen: (row: T) => void,
) {
  const unfolded = ref(new Set<string>());
  let pointerType = '';
  const cellId = (column: DataTableColumn<T>) => `${props.rowId}␟${column.key}`;
  const valueOf = (column: DataTableColumn<T>) => (props.row as Record<string, unknown>)[column.key];
  const isUnfolded = (column: DataTableColumn<T>) => unfolded.value.has(cellId(column));

  function open(): void {
    if (props.clickable) onOpen(props.row);
  }
  function onKeydown(event: KeyboardEvent): void {
    if (!props.clickable || !['Enter', ' ', 'Spacebar'].includes(event.key)) return;
    event.preventDefault();
    onOpen(props.row);
  }
  function onPointerdown(event: PointerEvent): void {
    pointerType = event.pointerType;
  }
  function onCellTap(event: MouseEvent, column: DataTableColumn<T>): void {
    const span = event.currentTarget as HTMLElement;
    if (props.clickable || pointerType !== 'touch' || span.scrollWidth <= span.clientWidth) return;
    unfolded.value = new Set(unfolded.value).add(cellId(column));
  }
  watch(() => [props.row, props.rows], () => { unfolded.value = new Set(); });

  return { valueOf, isUnfolded, open, onKeydown, onPointerdown, onCellTap };
}
