import { describe, expect, it } from 'vitest';

import cardSource from './DataTableCard.vue?raw';
import listSource from './DataTableListItem.vue?raw';
import actionsSource from './DataTableRowActions.vue?raw';
import stateSource from './DataTableState.vue?raw';
import { tableSource as source, toolbarSource } from './__tests__/part-sources';
import { gridTemplate } from './model';

const styles = (input: string) => input.match(/<style scoped>([\s\S]*?)<\/style>/)?.[1] ?? '';
const table = styles(source);
const card = styles(cardSource);
const list = styles(listSource);
const actions = styles(actionsSource);
const state = styles(stateSource);
const toolbar = styles(toolbarSource);

describe('the default focused presentation', () => {
  it('gives each card room for its icon, a name and its switch: 260px at least, one column when narrower', () => {
    expect(table).toMatch(/\.data-table__cards \{[^}]*grid-template-columns: repeat\(auto-fill, minmax\(min\(100%, 260px\), 1fr\)\)/);
  });

  it('uses quiet Ionic cards with a tiled icon and a strong title', () => {
    expect(card).toContain('border-radius: var(--ep-radius-lg)');
    expect(card).toContain('box-shadow: var(--ep-shadow-xs)');
    expect(card).toMatch(/\.data-table__card-icon \{[^}]*width: 44px;[^}]*background: var\(--ep-primary-tint\)/);
    expect(card).toMatch(/\.data-table__card-title \{[^}]*font-size: 17px/);
  });

  it('does not clip a slotted status chip or its wrapping text', () => {
    expect(table).not.toMatch(/\.data-table__cell > :deep\(span\) \{ overflow: hidden/);
    expect(list).toContain('.data-table__cell > :deep(span) { min-width: 0; }');
    expect(list).toContain('.data-table__row--data > .data-table__cell:not(.data-table__cell--actions) { flex-wrap: wrap;');
  });

  it('keeps every row action at least 44×44, with the main and the pinned actions outlined', () => {
    expect(actions).toContain('min-width: 44px; min-height: 44px');
    expect(actionsSource).toContain(":fill=\"primary || action.pinned ? 'outline' : 'clear'\"");
  });

  it('uses 44px toolbar controls, not desktop-only smaller targets', () => {
    expect(toolbar).toMatch(/\.data-table__add-button \{ min-height: 44px/);
    expect(toolbar).toMatch(/\.data-table__filter-button \{[^}]*width: 44px; height: 44px/);
    expect(toolbar).toMatch(/\.data-table__columns-select \{[^}]*min-height: 44px/);
    expect(toolbar).toMatch(/\.data-table__page-size-select \{[^}]*min-height: 44px/);
    expect(toolbar).toMatch(/\.data-table__view-segment ion-segment-button \{ min-width: 44px; min-height: 44px/);
  });

  it('loads with labelled Ionic skeletons and keeps complete empty and error actions', () => {
    expect(state).toContain('ion-skeleton-text');
    expect(stateSource).toContain('role="status"');
    expect(stateSource).toContain('<InlineFeedback');
    expect(stateSource).toContain('<EmptyState');
    expect(stateSource).toContain("emit('retry')");
    expect(stateSource).toContain("emit('reset')");
  });
});


describe('identity columns keep their reading width', () => {
  it('gives high-priority identity columns a 10rem floor and a larger flexible share', () => {
    const result = gridTemplate({
      selectable: false,
      columns: [{ key: 'name', label: 'Name', priority: 'high' }, { key: 'state', label: 'Status' }],
      hasActions: false,
      actionsTrackPx: 0,
    });
    expect(result).toBe('minmax(10rem,1.4fr) minmax(5.5rem,1fr)');
  });

  const measured = (need: number, clipped: boolean | 'tight') =>
    gridTemplate({
      selectable: false,
      columns: [{ key: 'name', label: 'Name', priority: 'high' }],
      hasActions: false,
      actionsTrackPx: 0,
      contentWidths: { name: need },
      clipped,
    });

  it('whole, a short name takes no more than its text: the other columns are not given up for empty room', () => {
    expect(measured(100, false)).toBe('minmax(100px,1.4fr)');
  });

  it('cut, a name keeps 10rem before its text is cut, or its whole text when shorter', () => {
    expect(measured(300, true)).toBe('minmax(min(10rem,300px),300px)');
    expect(measured(100, true)).toBe('minmax(min(10rem,100px),100px)');
  });

  it('cut to the bone (`tight`), a name gives up its 10rem down to the common floor', () => {
    expect(measured(300, 'tight')).toBe('minmax(5.5rem,300px)');
  });

  it('a text measured within the common floor (a short date) keeps that floor, never 10rem, whole or cut', () => {
    expect(measured(0, false)).toBe('minmax(5.5rem,1.4fr)');
    expect(measured(0, true)).toBe('minmax(5.5rem,1.4fr)');
  });
});
