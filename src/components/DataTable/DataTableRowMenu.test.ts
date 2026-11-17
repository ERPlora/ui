import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import DataTableRowMenu from './DataTableRowMenu.vue';
import type { DataTableAction } from './types';

type Row = { id: string; name: string };
const row: Row = { id: 'r1', name: 'Bar La Plaza' };
const archive: DataTableAction<Row> = { id: 'archive', label: (r) => `Archive ${r.name}`, icon: 'ion:archive-outline' };
const remove: DataTableAction<Row> = { id: 'delete', label: 'Delete', icon: 'ion:trash-outline', color: 'danger' };
const locked: DataTableAction<Row> = { id: 'lock', label: 'Lock', disabled: () => true };
const PopoverStub = { props: { isOpen: Boolean }, emits: ['didDismiss'], template: '<div v-if="isOpen"><slot /></div>' };

function mountMenu(extra: Record<string, unknown> = {}) {
  const props: Record<string, unknown> = { row, actions: [archive, remove, locked], ...extra };
  return mount(DataTableRowMenu, {
    props: { open: true, actions: [], hook: 'biz-row-r1', ...props },
    global: { stubs: { IonPopover: PopoverStub } },
  });
}
const items = (wrapper: ReturnType<typeof mountMenu>) => wrapper.findAll('ion-item');

describe('DataTableRowMenu', () => {
  it('lists the row’s actions with icon and label, each with its hook', () => {
    const wrapper = mountMenu();
    expect(items(wrapper).map((item) => item.attributes('data-testid'))).toEqual(['biz-row-r1-archive', 'biz-row-r1-delete', 'biz-row-r1-lock']);
    expect(items(wrapper)[0].find('ion-label').html()).toContain('Archive Bar La Plaza');
    expect(items(wrapper)[0].find('ion-icon[slot="start"]').exists()).toBe(true);
    expect(items(wrapper)[2].find('ion-icon').exists()).toBe(false);
  });

  it('paints an action with its tone', () => {
    expect(items(mountMenu())[1].find('ion-label').attributes('style')).toContain('color: var(--ion-color-danger, #c5000f)');
  });

  it('emits the picked action, never a disabled one', async () => {
    const wrapper = mountMenu();
    await items(wrapper)[0].trigger('click');
    await items(wrapper)[2].trigger('click');
    expect(wrapper.emitted('pick')).toEqual([[archive]]);
    expect(items(wrapper)[2].attributes('aria-disabled')).toBe('true');
  });

  it('nothing to show without a row; closing is reported', async () => {
    expect(mountMenu({ row: undefined }).find('ion-item').exists()).toBe(false);
    const wrapper = mountMenu();
    await wrapper.findComponent(PopoverStub).vm.$emit('didDismiss');
    expect(wrapper.emitted('dismiss')).toHaveLength(1);
  });
});
