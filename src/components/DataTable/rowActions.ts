import { inlineActions, rowActionsFolded, visibleActions } from './model';
import type { DataTableAction, DataTableActionCell } from './types';

/** The most buttons a list row shows; whatever else applies to the row is in its «⋮». */
export const MAX_ROW_BUTTONS = 2;

/** A list row: up to `maxInline` buttons (never more than two), pinned ones first in line. Folded for
 *  room, only the pinned ones stay, and a lone icon action, which is no wider than «⋮». */
export function listRowActions<T>(
  actions: readonly DataTableAction<T>[],
  row: T,
  fit: { maxInline: number; folded: boolean },
): DataTableActionCell<T> {
  const visible = visibleActions(actions, row);
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
export function cardRowActions<T>(actions: readonly DataTableAction<T>[], row: T): DataTableActionCell<T> {
  const visible = visibleActions(actions, row);
  const main = visible.find((a) => a.pinned === true && a.menuOnly !== true) ?? visible.find((a) => a.menuOnly !== true);
  return { items: main ? [{ action: main, primary: true }] : [], menu: visible.filter((a) => a !== main) };
}
