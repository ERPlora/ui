import { describe, expect, it } from 'vitest';

import { cardRowActions, listRowActions } from './rowActions';
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
