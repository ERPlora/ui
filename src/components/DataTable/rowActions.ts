import { pageLabel } from './labels';
import { actionLabel, inlineActions, rowActionsFolded, visibleActions } from './model';
import type { DataTableAction, DataTableActionCell } from './types';

/** The most buttons a list row shows; whatever else applies to the row is in its «⋮». */
export const MAX_ROW_BUTTONS = 2;

/** A list row: up to `maxInline` buttons (never more than two), pinned ones first in line. Folded for
 *  room, only the pinned ones stay, and a lone icon action, which is no wider than «⋮». `title` names them. */
export function listRowActions<T>(
  actions: readonly DataTableAction<T>[],
  row: T,
  fit: { maxInline: number; folded: boolean; title?: string | number },
): DataTableActionCell<T> {
  const visible = namedFor(visibleActions(actions, row), fit.title);
  const room = Math.min(Math.max(0, fit.maxInline), MAX_ROW_BUTTONS);
  const loose = visible.filter((a) => a.menuOnly !== true && a.pinned !== true);
  const keepLoose = fit.folded && !rowActionsFolded(true, loose);
  const inline = (fit.folded && !keepLoose ? inlineActions(visible, 'all', room) : inlineActions(visible, 'extra', room)).slice(
    0,
    MAX_ROW_BUTTONS,
  );
  return { items: inline.map((action) => ({ action })), menu: visible.filter((a) => !inline.includes(a)) };
}

/** A card: one main button (the pinned action, else the first that is not `menuOnly`) and «⋮» for the rest. */
export function cardRowActions<T>(actions: readonly DataTableAction<T>[], row: T, title?: string | number): DataTableActionCell<T> {
  const visible = namedFor(visibleActions(actions, row), title);
  const main = visible.find((a) => a.pinned === true && a.menuOnly !== true) ?? visible.find((a) => a.menuOnly !== true);
  return { items: main ? [{ action: main, primary: true }] : [], menu: visible.filter((a) => a !== main) };
}

/** Each action named for a screen reader with the row it affects, «Change role: Carlos Ruiz», from the row's title
 *  (its card title); an action that brings its own `ariaLabel` keeps it, and without a title the label stays the name. */
function namedFor<T>(actions: DataTableAction<T>[], title: string | number | undefined): DataTableAction<T>[] {
  const name = String(title ?? '').trim();
  if (!name) return actions;
  return actions.map((action) =>
    action.ariaLabel ? action : { ...action, ariaLabel: (row: T) => pageLabel('rowAction', { action: actionLabel(action, row), name }) },
  );
}
