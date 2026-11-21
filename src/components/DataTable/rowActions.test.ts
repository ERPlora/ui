import { describe, expect, it } from 'vitest';

import { cardRowActions, inlineActions, listRowActions, rowActionsFolded, slotActions, toneStyle, visibleActions } from './rowActions';
import type { DataTableAction, DataTableActionCell } from './types';

type Row = { id: string; paid?: boolean };
const row: Row = { id: 'r1' };
const action = (id: string, extra: Partial<DataTableAction<Row>> = {}): DataTableAction<Row> => ({ id, label: id, icon: 'ion:ellipse', ...extra });
const ids = (cell: DataTableActionCell<Row>) => ({ buttons: cell.items.map((slot) => slot.action.id), menu: cell.menu.map((a) => a.id) });

describe('listRowActions: what a list row shows as buttons and what goes into «⋮»', () => {
  const unfolded = { maxInline: 2, folded: false };

  it('two buttons at most, in their order; the rest goes into the menu', () => {
    const cell = listRowActions([action('a'), action('b'), action('c'), action('d')], row, unfolded);
    expect(ids(cell)).toEqual({ buttons: ['a', 'b'], menu: ['c', 'd'] });
  });

  it('no menu when every action has a button', () => {
    expect(ids(listRowActions([action('a'), action('b')], row, unfolded))).toEqual({ buttons: ['a', 'b'], menu: [] });
  });

  it('a pinned action takes a place first and keeps its order', () => {
    const cell = listRowActions([action('a'), action('b'), action('open', { pinned: true })], row, unfolded);
    expect(ids(cell)).toEqual({ buttons: ['a', 'open'], menu: ['b'] });
  });

  it('never more than two buttons, even when the table allows more or several are pinned', () => {
    expect(ids(listRowActions([action('a'), action('b'), action('c')], row, { maxInline: 4, folded: false })).buttons).toEqual(['a', 'b']);
    const pinned = [action('a', { pinned: true }), action('b', { pinned: true }), action('c', { pinned: true })];
    expect(ids(listRowActions(pinned, row, unfolded))).toEqual({ buttons: ['a', 'b'], menu: ['c'] });
  });

  it('a smaller `maxInline` keeps fewer buttons', () => {
    expect(ids(listRowActions([action('a'), action('b')], row, { maxInline: 1, folded: false }))).toEqual({ buttons: ['a'], menu: ['b'] });
  });

  it('`menuOnly` actions are always in the menu, and hidden ones nowhere', () => {
    const cell = listRowActions([action('delete', { menuOnly: true }), action('edit'), action('pay', { hidden: () => true })], row, unfolded);
    expect(ids(cell)).toEqual({ buttons: ['edit'], menu: ['delete'] });
  });

  it('folded for room, only the pinned ones stay buttons', () => {
    const cell = listRowActions([action('open', { pinned: true }), action('b'), action('c')], row, { maxInline: 2, folded: true });
    expect(ids(cell)).toEqual({ buttons: ['open'], menu: ['b', 'c'] });
  });

  it('folded, a single icon action stays a button: «⋮» would not be narrower', () => {
    expect(ids(listRowActions([action('edit')], row, { maxInline: 2, folded: true }))).toEqual({ buttons: ['edit'], menu: [] });
    expect(ids(listRowActions([action('use', { icon: undefined })], row, { maxInline: 2, folded: true }))).toEqual({ buttons: [], menu: ['use'] });
  });

  it('no list button is the card’s primary one', () => {
    expect(listRowActions([action('a', { pinned: true })], row, unfolded).items.every((slot) => !slot.primary)).toBe(true);
  });
});

describe('cardRowActions: one main button and «⋮»', () => {
  it('the pinned action is the main button, everything else goes into the menu', () => {
    const cell = cardRowActions([action('a'), action('open', { pinned: true }), action('c')], row);
    expect(ids(cell)).toEqual({ buttons: ['open'], menu: ['a', 'c'] });
    expect(cell.items[0].primary).toBe(true);
  });

  it('without a pinned one, the first action that is not `menuOnly`', () => {
    expect(ids(cardRowActions([action('delete', { menuOnly: true }), action('edit')], row))).toEqual({ buttons: ['edit'], menu: ['delete'] });
  });

  it('only `menuOnly` actions: no main button, just the menu', () => {
    expect(ids(cardRowActions([action('delete', { menuOnly: true })], row))).toEqual({ buttons: [], menu: ['delete'] });
  });

  it('what is hidden for the row is not offered', () => {
    const paid = (r: Row) => r.paid === true;
    const settled: Row = { id: 'r2', paid: true };
    expect(ids(cardRowActions([action('pay', { pinned: true, hidden: paid }), action('edit')], settled))).toEqual({
      buttons: ['edit'],
      menu: [],
    });
  });
});

describe('the row’s title names each action for a screen reader', () => {
  const unfolded = { maxInline: 2, folded: false };
  const names = (cell: DataTableActionCell<Row>) => [...cell.items.map((slot) => slot.action), ...cell.menu].map((a) => a.ariaLabel?.(row));

  it('a list row, its buttons and its «⋮»: «<action>: <title>»', () => {
    const cell = listRowActions([action('Edit'), action('Pay'), action('Delete')], row, { ...unfolded, title: 'Bar La Plaza' });
    expect(names(cell)).toEqual(['Edit: Bar La Plaza', 'Pay: Bar La Plaza', 'Delete: Bar La Plaza']);
  });

  it('a card, its main button and its «⋮»', () => {
    const cell = cardRowActions([action('Delete'), action('Open', { pinned: true })], row, 'Bar La Plaza');
    expect(names(cell)).toEqual(['Open: Bar La Plaza', 'Delete: Bar La Plaza']);
  });

  it('a label read from the row is the one said, and a number title is a name too', () => {
    const cell = listRowActions([action('pay', { label: (r) => `Pay ${r.id}` })], row, { ...unfolded, title: 42 });
    expect(names(cell)).toEqual(['Pay r1: 42']);
  });

  it('an action that brings its own name keeps it', () => {
    const own = action('Edit', { ariaLabel: (r) => `Edit the order ${r.id}` });
    expect(names(listRowActions([own], row, { ...unfolded, title: 'Bar La Plaza' }))).toEqual(['Edit the order r1']);
  });

  it('without a title, or a blank one, the short label stays the name', () => {
    expect(names(listRowActions([action('Edit')], row, unfolded))).toEqual([undefined]);
    expect(names(cardRowActions([action('Edit')], row, '  '))).toEqual([undefined]);
  });
});

describe('row actions', () => {
  type Row = Record<string, unknown>;
  const rows: Row[] = [{ id: 'a', update: null }, { id: 'b', update: '2.0' }];
  const open: DataTableAction<Row> = { id: 'open', label: 'Open', icon: 'open-outline' };
  const update: DataTableAction<Row> = { id: 'update', label: 'Update', icon: 'cloud-download-outline', hidden: (r) => !r.update };
  const use: DataTableAction<Row> = { id: 'use', label: 'Use template' };

  it('visibleActions drops what is hidden for that row', () => {
    expect(visibleActions([open, update], rows[0]).map((a) => a.id)).toEqual(['open']);
    expect(visibleActions([open, update], rows[1]).map((a) => a.id)).toEqual(['open', 'update']);
  });

  it('slotActions keeps a column only for actions some row shows', () => {
    expect(slotActions([open, update], rows).map((a) => a.id)).toEqual(['open', 'update']);
    expect(slotActions([open, update], [rows[0]]).map((a) => a.id)).toEqual(['open']);
  });

  it('folds only when collapsed and there is more than one, or a single TEXT action', () => {
    expect(rowActionsFolded(false, [open, update])).toBe(false);
    expect(rowActionsFolded(true, [open, update])).toBe(true);
    expect(rowActionsFolded(true, [open])).toBe(false);
    expect(rowActionsFolded(true, [use])).toBe(true);
    expect(rowActionsFolded(true, [])).toBe(false);
    expect(rowActionsFolded(true, [{ ...open, showLabel: true }]), 'an icon with its label is wider than «⋮»').toBe(true);
  });
});

describe('inlineActions: the actions that keep a button at each fold of the row', () => {
  const action = (id: string, extra: Partial<DataTableAction<Row>> = {}): DataTableAction<Row> => ({ id, label: id, icon: 'ellipse', ...extra });
  const open = action('open', { pinned: true });
  const manage = action('manage');
  const pay = action('pay');
  const transfer = action('transfer', { menuOnly: true });
  const ids = (actions: DataTableAction<Row>[]) => actions.map((a) => a.id);

  it('unfolded: every action but the `menuOnly` ones, however many (the box has room)', () => {
    expect(ids(inlineActions([open, manage, pay, transfer], 'none', 2))).toEqual(['open', 'manage', 'pay']);
    expect(ids(inlineActions([manage, pay, action('x'), action('y')], 'none', 1))).toEqual(['manage', 'pay', 'x', 'y']);
  });

  it('`extra`: the first `maxInline`, in their order; a pinned one counts first and never leaves', () => {
    expect(ids(inlineActions([manage, pay, action('x')], 'extra', 2))).toEqual(['manage', 'pay']);
    expect(ids(inlineActions([manage, pay, open], 'extra', 2)), 'pinned takes a place, kept in order').toEqual(['manage', 'open']);
    expect(ids(inlineActions([open, manage, pay, transfer], 'extra', 1))).toEqual(['open']);
    expect(ids(inlineActions([open, action('main', { pinned: true }), manage], 'extra', 1)), 'pinned ones beyond the limit stay').toEqual([
      'open',
      'main',
    ]);
    expect(ids(inlineActions([manage, pay], 'extra', 0))).toEqual([]);
  });

  it('`all`: only the pinned ones; `menuOnly` never, even pinned', () => {
    expect(ids(inlineActions([open, manage, pay, transfer], 'all', 2))).toEqual(['open']);
    expect(ids(inlineActions([action('odd', { pinned: true, menuOnly: true }), manage], 'all', 2))).toEqual([]);
    expect(ids(inlineActions([action('odd', { pinned: true, menuOnly: true })], 'none', 2))).toEqual([]);
  });
});

describe('toneStyle', () => {
  it('paints from the --ion-color token with Ionic’s default hex', () => {
    expect(toneStyle('danger', 'clear')).toBe('--color: var(--ion-color-danger, #c5000f);');
    expect(toneStyle('medium', 'text')).toBe('color: var(--ion-color-medium, #636469);');
    expect(toneStyle('brand', 'clear')).toBe('--color: var(--ion-color-brand);');
  });
  it('refuses an empty or unsafe tone (it goes into CSS)', () => {
    expect(toneStyle(undefined, 'clear')).toBeUndefined();
    expect(toneStyle('red;}', 'clear')).toBeUndefined();
  });
});
