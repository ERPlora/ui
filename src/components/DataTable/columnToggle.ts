import type { DataTableColumnToggle } from './types';

/** The switch a column gives a row, as `DataTableToggle` paints it. */
export function toggleState<T>(toggle: DataTableColumnToggle<T>, row: T) {
  return {
    checked: toggle.checked(row),
    label: toggle.label(row),
    disabled: toggle.disabled?.(row) === true,
    busy: toggle.busy?.(row) === true,
    busyLabel: toggle.busyLabel,
  };
}

/** Why the row's switch cannot change, or what went wrong; nothing when there is nothing to say. */
export function toggleNote<T>(toggle: DataTableColumnToggle<T> | undefined, row: T): { text: string; tone: 'muted' | 'danger' } | undefined {
  const text = toggle?.note?.(row);
  if (!toggle || !text) return undefined;
  return { text, tone: toggle.noteTone?.(row) ?? 'muted' };
}
