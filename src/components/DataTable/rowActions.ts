import { pageLabel } from './labels';
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

export function visibleActions<T>(actions: readonly DataTableAction<T>[], row: T): DataTableAction<T>[] {
  return actions.filter((a) => a.hidden?.(row) !== true);
}

/** The actions that get a column in the list: those at least one row shows. */
export function slotActions<T>(actions: readonly DataTableAction<T>[], rows: readonly T[]): DataTableAction<T>[] {
  return actions.filter((a) => rows.some((row) => a.hidden?.(row) !== true));
}

export function iconWithLabel<T>(action: DataTableAction<T>): boolean {
  return !!action.icon && action.showLabel === true;
}

/** Are these row actions folded into the «…» menu? Only when the list folds AND there is more than
 *  one, or a single action with text (wider than the «…» button itself). */
export function rowActionsFolded<T>(collapsed: boolean, actions: readonly DataTableAction<T>[]): boolean {
  return collapsed && (actions.length > 1 || (actions.length === 1 && (!actions[0].icon || iconWithLabel(actions[0]))));
}

/** How far the row actions are folded into «⋮»: not at all, beyond `maxInlineActions`, or all but
 *  the pinned ones. */
export type RowActionsFold = 'none' | 'extra' | 'all';

/** The actions that keep a button at a fold, in their order. A `menuOnly` one never does; a
 *  `pinned` one always does (and takes one of the `maxInline` places first). */
export function inlineActions<T>(actions: readonly DataTableAction<T>[], fold: RowActionsFold, maxInline: number): DataTableAction<T>[] {
  const candidates = actions.filter((a) => a.menuOnly !== true);
  if (fold === 'none') return candidates;
  if (fold === 'all') return candidates.filter((a) => a.pinned === true);
  let room = Math.max(0, maxInline - candidates.filter((a) => a.pinned === true).length);
  return candidates.filter((a) => a.pinned === true || room-- > 0);
}

export function actionLabel<T>(action: DataTableAction<T>, row: T): string {
  return typeof action.label === 'function' ? action.label(row) : action.label;
}

/** Ionic 8 default palette, the last fallback when the theme does not define the token. */
const DEFAULT_HEX: Record<string, string> = {
  primary: '#0054e9',
  secondary: '#0163aa',
  tertiary: '#6030ff',
  success: '#2dd55b',
  warning: '#ffc409',
  danger: '#c5000f',
  light: '#f4f5f8',
  medium: '#636469',
  dark: '#222428',
};

/** A theme colour name: lowercase, digits and dashes. Anything else is refused (it goes into CSS). */
const TONE_NAME = /^[a-z][a-z0-9-]*$/;

/** Inline style that paints a control with a theme tone: `clear` for an `ion-button`
 *  `fill="clear"` (its `--color`), `text` for an `ion-icon`/`ion-label` (`color`). Inline, because
 *  the row menu popover is teleported out of the table. `undefined` for an empty or unsafe tone. */
export function toneStyle(tone: string | undefined, variant: 'clear' | 'text'): string | undefined {
  if (!tone || !TONE_NAME.test(tone)) return undefined;
  const hex = DEFAULT_HEX[tone];
  const value = `var(--ion-color-${tone}${hex ? `, ${hex}` : ''})`;
  return variant === 'clear' ? `--color: ${value};` : `color: ${value};`;
}
