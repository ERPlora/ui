import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import DataTableListItem from './DataTableListItem.vue';
import source from './DataTableListItem.vue?raw';

const row = { id: '1', name: 'Invoicing', total: '10,00 €' };

function mountRow(props: Record<string, unknown> = {}, slots: Record<string, string> = {}) {
  return mount(DataTableListItem, {
    props: {
      row,
      rowId: '1',
      columns: [{ key: 'name', label: 'App' }, { key: 'total', label: 'Total', align: 'right' }],
      template: 'minmax(5.5rem,1fr) minmax(5.5rem,1fr)',
      actions: { items: [], menu: [] },
      testid: 'apps',
      ...props,
    },
    slots,
  });
}

describe('DataTableListItem', () => {
  it('keeps the grid template, cells and row hooks of the list', () => {
    const wrapper = mountRow();
    const item = wrapper.find('.data-table__row--data');
    expect(item.attributes('role')).toBe('row');
    expect(item.attributes('data-testid')).toBe('apps-row');
    expect(item.attributes('data-id')).toBe('1');
    expect((item.element as HTMLElement).style.gridTemplateColumns).toBe('minmax(5.5rem,1fr) minmax(5.5rem,1fr)');
    expect(wrapper.findAll('[role="cell"]').map((cell) => cell.text())).toEqual(['Invoicing', '10,00 €']);
    expect(wrapper.findAll('[role="cell"]')[1].classes()).toContain('data-table__cell--right');
  });

  it('forwards cell slots and emits row and selection interactions', async () => {
    const wrapper = mountRow(
      { clickable: true, selectable: true, columns: [{ key: 'name', label: 'App', cell: 'name' }, { key: 'total', label: 'Total', align: 'right' }] },
      { name: '<template #name="{ value }"><strong class="custom-cell">{{ value }}</strong></template>' },
    );
    expect(wrapper.find('.custom-cell').text()).toBe('Invoicing');
    await wrapper.find('.data-table__row--data').trigger('click');
    await wrapper.find('.data-table__row--data').trigger('keydown', { key: ' ' });
    await wrapper.find('ion-checkbox').trigger('ionChange', { checked: true });
    expect(wrapper.emitted('open')).toEqual([[row], [row]]);
    expect(wrapper.emitted('select')).toEqual([['1']]);
  });
});


describe('the list item owns its cell layout', () => {
  it('makes cells flexible and keeps alignment and pinning inside the child component', () => {
    expect(source).toContain('.data-table__cell { display: flex; align-items: center; min-width: 0; }');
    expect(source).toContain('.data-table__cell--right { justify-content: flex-end; text-align: right; }');
    expect(source).toContain('.data-table__cell--center { justify-content: center; text-align: center; }');
    expect(source).toMatch(/\.data-table__cell--pinned \{ position: sticky; right: 0;/);
  });
});


describe('what a cell holds stays under the sticky head and the pinned actions', () => {
  // Ionic's ion-toggle carries `position: relative; z-index: 2` on its host, the head's own z-index: later in
  // the page, it painted over the head while the list scrolled under it.
  it('every data cell is a stacking context of its own', () => {
    expect(source).toContain('.data-table__row--data > .data-table__cell { isolation: isolate; }');
  });
});

describe('the focused row rhythm', () => {
  it('keeps a comfortable minimum height and vertical separation around actions', () => {
    expect(source).toMatch(/\.data-table__row--data \{[^}]*min-height: 80px/);
    expect(source).toMatch(/\.data-table__row--data \{[^}]*padding-top: 0\.75rem; padding-bottom: 0\.75rem/);
  });
});

describe('a column with a switch', () => {
  const state = {
    key: 'state',
    label: 'State',
    cell: 'state',
    toggle: {
      checked: () => true,
      label: () => 'Turn Invoicing off',
      note: () => 'Required in Spain',
      noteTone: () => 'muted' as const,
    },
  };
  const slots = { state: '<template #state><span class="custom-chip">Active</span></template>' };

  it('starts its cell with the switch, then the cell’s own content, and the note on a line of its own', () => {
    const cell = mountRow({ columns: [state] }, slots).find('[role="cell"]');
    const children = [...cell.element.children].map((el) => el.className.split(' ')[0]);
    expect(children).toEqual(['data-table__toggle', 'custom-chip', 'data-table__cell-note']);
    expect(cell.find('ion-toggle').attributes('aria-label')).toBe('Turn Invoicing off');
    expect(cell.find('.data-table__cell-note').text()).toBe('Required in Spain');
  });

  it('a failure note reads as one', () => {
    const failed = { ...state, toggle: { ...state.toggle, noteTone: () => 'danger' as const } };
    const note = mountRow({ columns: [failed] }, slots).find('.data-table__cell-note');
    expect(note.classes()).toContain('data-table__cell-note--danger');
  });

  it('a flip emits `toggle` with the column, the row and the state asked for', async () => {
    const wrapper = mountRow({ columns: [state] }, slots);
    const toggle = wrapper.find('ion-toggle');
    toggle.element.dispatchEvent(new CustomEvent('ionChange', { detail: { checked: false } }));
    expect(wrapper.emitted('toggle')).toEqual([[{ column: 'state', row, checked: false }]]);
  });

  it('a row the column hides it for keeps the note, without the switch', () => {
    const readOnly = { ...state, toggle: { ...state.toggle, hidden: () => true } };
    const cell = mountRow({ columns: [readOnly] }, slots).find('[role="cell"]');
    expect(cell.find('ion-toggle').exists()).toBe(false);
    expect(cell.find('.data-table__cell-note').text()).toBe('Required in Spain');
  });

  it('a column without one has neither switch nor note', () => {
    const wrapper = mountRow();
    expect(wrapper.find('ion-toggle').exists()).toBe(false);
    expect(wrapper.find('.data-table__cell-note').exists()).toBe(false);
  });
});
