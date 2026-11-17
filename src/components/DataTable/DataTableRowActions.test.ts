import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import DataTableRowActions from './DataTableRowActions.vue';

const row = { id: '1', name: 'Invoicing' };
const open = { id: 'open', label: 'Open', icon: 'open-outline', showLabel: true, pinned: true };
const remove = { id: 'remove', label: 'Remove', icon: 'trash-outline', menuOnly: true };

function mountActions(props: Record<string, unknown> = {}) {
  return mount(DataTableRowActions, {
    props: {
      row,
      rowId: '1',
      items: [{ action: open, gap: false }],
      menu: [remove],
      testid: 'apps',
      moreLabel: 'More actions',
      ...props,
    },
  });
}

describe('DataTableRowActions', () => {
  it('keeps the main action visible and labelled as an outline Ionic button', () => {
    const wrapper = mountActions();
    const button = wrapper.find('[data-testid="apps-row-1-open"]');
    expect(button.text()).toBe('Open');
    expect((button.element as HTMLElement & { fill?: string }).fill).toBe('outline');
    expect(button.classes()).toContain('data-table__action--primary');
    expect(wrapper.find('[data-testid="apps-row-1-menu"]').attributes('aria-label')).toBe('More actions');
  });

  it('emits the action and opens the menu for that row', async () => {
    const wrapper = mountActions();
    await wrapper.find('[data-testid="apps-row-1-open"]').trigger('click');
    await wrapper.find('[data-testid="apps-row-1-menu"]').trigger('click');
    expect(wrapper.emitted('action')).toEqual([[{ action: open, row }]]);
    expect(wrapper.emitted('menu')?.[0][1]).toEqual(row);
  });
});
