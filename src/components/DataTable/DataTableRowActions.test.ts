import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import DataTableRowActions from './DataTableRowActions.vue';
import type { DataTableAction } from './types';

type Row = { id: string; name: string };
const row: Row = { id: '1', name: 'Invoicing' };
const open: DataTableAction<Row> = { id: 'open', label: 'Open', icon: 'ion:open-outline', pinned: true };
const edit: DataTableAction<Row> = { id: 'edit', label: 'Edit', icon: 'ion:create-outline' };
const plans: DataTableAction<Row> = { id: 'plans', label: 'See plans', icon: 'ion:storefront-outline', showLabel: true };
const use: DataTableAction<Row> = { id: 'use', label: 'Use template' };
const remove: DataTableAction<Row> = { id: 'remove', label: 'Remove', icon: 'ion:trash-outline', menuOnly: true };

function mountActions(items: { action: DataTableAction<Row>; primary?: boolean }[], menu: DataTableAction<Row>[] = []) {
  const props: Record<string, unknown> = { items, menu };
  return mount(DataTableRowActions, {
    props: { row, rowId: '1', testid: 'apps', moreLabel: 'More actions', items: [], menu: [], ...props },
  });
}
const button = (wrapper: ReturnType<typeof mountActions>, id: string) => wrapper.find(`[data-testid="apps-row-1-${id}"]`);

describe('DataTableRowActions in a list row', () => {
  it('an action with an icon is an icon-only button named by its label, also as its tooltip', () => {
    const wrapper = mountActions([{ action: edit }]);
    const edited = button(wrapper, 'edit');
    expect(edited.text()).toBe('');
    expect(edited.attributes('aria-label')).toBe('Edit');
    expect(edited.attributes('title')).toBe('Edit');
    expect(edited.find('ion-icon[slot="icon-only"]').exists()).toBe(true);
  });

  it('a pinned action is outlined and still icon-only', () => {
    const opened = button(mountActions([{ action: open }, { action: edit }]), 'open');
    expect((opened.element as HTMLElement & { fill?: string }).fill).toBe('outline');
    expect(opened.text()).toBe('');
    expect(opened.classes()).not.toContain('data-table__action--main');
  });

  it('`showLabel` keeps its text beside the icon', () => {
    const shown = button(mountActions([{ action: plans }]), 'plans');
    expect(shown.text()).toBe('See plans');
    expect(shown.find('ion-icon[slot="start"]').exists()).toBe(true);
  });

  it('an action without an icon is its text, never an empty button', () => {
    expect(button(mountActions([{ action: use }]), 'use').text()).toBe('Use template');
  });

  it('no invisible stand-ins: only the actions the row offers are there', () => {
    const wrapper = mountActions([{ action: edit }]);
    expect(wrapper.findAll('ion-button')).toHaveLength(1);
    expect(wrapper.find('[data-slot-for]').exists()).toBe(false);
  });

  it('«⋮» only when something is left for the menu, 44 px square and named', () => {
    expect(mountActions([{ action: edit }]).find('[data-testid="apps-row-1-menu"]').exists()).toBe(false);
    const more = mountActions([{ action: edit }], [remove]).find('[data-testid="apps-row-1-menu"]');
    expect(more.attributes('aria-label')).toBe('More actions');
    expect(more.attributes('title')).toBe('More actions');
    expect(more.attributes('aria-haspopup')).toBe('menu');
  });

  it('busy, the spinner takes the icon’s place and the button cannot be pressed', async () => {
    const wrapper = mountActions([{ action: { ...edit, loading: () => true } }]);
    expect(button(wrapper, 'edit').find('ion-spinner').exists()).toBe(true);
    expect(button(wrapper, 'edit').attributes('aria-disabled')).toBe('true');
    await button(wrapper, 'edit').trigger('click');
    expect(wrapper.emitted('action')).toBeUndefined();
  });

  it('emits the action and opens the menu for that row', async () => {
    const wrapper = mountActions([{ action: edit }], [remove]);
    await button(wrapper, 'edit').trigger('click');
    await wrapper.find('[data-testid="apps-row-1-menu"]').trigger('click');
    expect(wrapper.emitted('action')).toEqual([[{ action: edit, row }]]);
    expect(wrapper.emitted('menu')?.[0][1]).toEqual(row);
  });
});

describe('DataTableRowActions on a card', () => {
  it('the main action is an outlined button with its icon and its text', () => {
    const main = button(mountActions([{ action: edit, primary: true }], [remove]), 'edit');
    expect(main.text()).toBe('Edit');
    expect((main.element as HTMLElement & { fill?: string }).fill).toBe('outline');
    expect(main.classes()).toContain('data-table__action--main');
    expect(main.find('ion-icon[slot="start"]').exists()).toBe(true);
  });
});
