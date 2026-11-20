import { pageLabel } from './labels';
import { actionLabel } from './model';
import type { DataTableAction } from './types';

/** Gives each row action the name a screen reader says, with whom it affects: «Change role: Carlos Ruiz». Its short
 *  label goes first, as it is what voice control hears (WCAG 2.5.3); the text on screen does not change. */
export function withRowNames<T>(nameOf: (row: T) => string, actions: DataTableAction<T>[]): DataTableAction<T>[] {
  return actions.map((action) => ({
    ...action,
    ariaLabel: (row: T) => pageLabel('rowAction', { action: actionLabel(action, row), name: nameOf(row) }),
  }));
}
