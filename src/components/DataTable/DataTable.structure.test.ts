// happy-dom does not lay out CSS, so this pins the class names the template paints, which the stylesheet hangs
// on: a later clean-up cannot silently drop one. The rules themselves are pinned in DataTable.visual.test.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mountTable, ROWS, settle, viewport } from './__tests__/harness';

beforeEach(() => {
  viewport(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('the painted structure (class names the stylesheet hangs on)', () => {
  it('list view with toolbar, selection, row actions and pager', async () => {
    const t = mountTable({
      rows: ROWS,
      columns: [{ key: 'name', label: 'Name' }, { key: 'total', label: 'Total', align: 'right' }],
      title: 'Customers',
      searchable: true,
      selectable: true,
      selected: ['1'],
      views: true,
      addable: true,
      actions: [{ id: 'edit', label: 'Edit', icon: 'create-outline' }],
      pageSize: 2,
    });
    await settle();
    for (const cls of [
      'data-table',
      'data-table__surface',
      'data-table__bar',
      'data-table__bar-main',
      'data-table__title-wrap',
      'data-table__title',
      'data-table__title-count',
      'data-table__search',
      'data-table__spacer',
      'data-table__columns-select',
      'data-table__page-size-select',
      'data-table__view-segment',
      'data-table__primary-button',
      'data-table__add-button',
      'data-table__selection-bar',
      'data-table__selection-clear',
      'data-table__scroll',
      'data-table__grid',
      'data-table__row',
      'data-table__row--head',
      'data-table__row--data',
      'data-table__row--selected',
      'data-table__select-cell',
      'data-table__cell',
      'data-table__cell--header',
      'data-table__cell--sortable',
      'data-table__cell--right',
      'data-table__cell--pinned',
      'data-table__cell--actions',
      'data-table__caret',
      'data-table__text',
      'data-table__actions',
      'data-table__pager',
      'data-table__pager-info',
      'data-table__pager-count',
      'data-table__pager-nav',
      'data-table__page',
      'data-table__page--current',
    ]) {
      expect(t.element.querySelector(`.${cls}`) ?? (t.element.classList.contains(cls) ? t.element : null), cls).not.toBeNull();
    }
    expect(t.findAll('.data-table__row--data')).toHaveLength(2);
    expect(t.find('ion-searchbar').classes()).toContain('ion-no-border');
  });

  it('card view and the three states', async () => {
    const cardsView = mountTable({ rows: ROWS, columns: [{ key: 'name', label: 'Name' }, { key: 'total', label: 'Total' }], views: true, defaultView: 'cards', selectable: true, cardTitle: (r: { name: string }) => r.name, cardIcon: () => 'person-outline', actions: [{ id: 'edit', label: 'Edit' }] });
    const empty = mountTable({ rows: [], columns: [{ key: 'name', label: 'Name' }] });
    const failed = mountTable({ rows: [], columns: [{ key: 'name', label: 'Name' }], error: 'Down' });
    const loading = mountTable({ rows: [], columns: [{ key: 'name', label: 'Name' }], loading: true });
    await settle();
    for (const cls of ['data-table__cards', 'data-table__card', 'data-table__card-head', 'data-table__card-icon', 'data-table__card-title', 'data-table__card-body', 'data-table__card-meta', 'data-table__card-meta-label', 'data-table__card-meta-value', 'data-table__card-actions']) {
      expect(cardsView.element.querySelector(`.${cls}`), cls).not.toBeNull();
    }
    expect(cardsView.findAll('.data-table__card')).toHaveLength(3);
    // Empty and failed are the library's own notices, inside the table's room for them.
    expect(empty.find('.data-table__empty .empty-state ion-icon').exists()).toBe(true);
    expect(failed.find('.data-table__error .inline-feedback ion-icon').exists()).toBe(true);
    expect(loading.findAll('.data-table__loading ion-skeleton-text').length).toBeGreaterThan(2);
  });
});
