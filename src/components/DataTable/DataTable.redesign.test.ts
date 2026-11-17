import { describe, expect, it } from 'vitest';

import cardSource from './DataTableCard.vue?raw';
import listSource from './DataTableListItem.vue?raw';
import actionsSource from './DataTableRowActions.vue?raw';
import stateSource from './DataTableState.vue?raw';
import source from './DataTable.vue?raw';
import { gridTemplate } from './model';

const styles = (input: string) => input.match(/<style scoped>([\s\S]*?)<\/style>/)?.[1] ?? '';
const table = styles(source);
const card = styles(cardSource);
const list = styles(listSource);
const actions = styles(actionsSource);
const state = styles(stateSource);

describe('the default focused presentation', () => {
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

  it('keeps every row action at least 44×44, with the primary action outlined', () => {
    expect(actions).toContain('min-width: 44px; min-height: 44px');
    expect(actionsSource).toContain("primary || action.pinned) ? 'outline' : 'clear'");
  });

  it('uses 44px toolbar controls, not desktop-only smaller targets', () => {
    expect(table).toMatch(/\.data-table__add-button \{ min-height: 44px/);
    expect(table).toMatch(/\.data-table__filter-button \{[^}]*width: 44px; height: 44px/);
    expect(table).toMatch(/\.data-table__columns-select \{[^}]*min-height: 44px/);
    expect(table).toMatch(/\.data-table__page-size-select \{[^}]*min-height: 44px/);
    expect(table).toMatch(/\.data-table__view-segment ion-segment-button \{ min-width: 44px; min-height: 44px/);
  });

  it('loads with labelled Ionic skeletons and keeps complete empty and error actions', () => {
    expect(state).toContain('ion-skeleton-text');
    expect(stateSource).toContain('role="status"');
    expect(stateSource).toContain('role="alert"');
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
});
