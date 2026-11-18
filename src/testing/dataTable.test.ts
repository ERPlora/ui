import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { type Component, defineComponent, h, ref } from 'vue';

import DataTable from '../components/DataTable/DataTable.vue';
import { createShellI18n } from '../shell/i18n';
import { offeredRowActions, pressRowAction } from './dataTable';

type Row = { id: string; paid: boolean };
const rows: Row[] = [{ id: 'r1', paid: false }, { id: 'r2', paid: true }];
const actions = [
  { id: 'open', label: 'Open', icon: 'ion:open-outline', pinned: true },
  { id: 'edit', label: 'Edit', icon: 'ion:create-outline' },
  { id: 'pay', label: 'Pay', icon: 'ion:card-outline', hidden: (row: Row) => row.paid },
  { id: 'lock', label: 'Lock', icon: 'ion:lock-closed-outline', disabled: () => true },
  { id: 'delete', label: 'Delete', icon: 'ion:trash-outline', menuOnly: true },
];

/** A page that keeps what its table emits, as the apps' pages do. */
function page() {
  const pressed = ref<string[]>([]);
  const Page = defineComponent({
    setup() {
      return () =>
        h(DataTable as unknown as Component, {
          rows,
          columns: [{ key: 'id', label: 'Id' }],
          actions,
          testid: 'things',
          onAction: (event: { actionId: string; row: Row }) => pressed.value.push(`${event.actionId}:${event.row.id}`),
        });
    },
  });
  const wrapper = mount(Page, { global: { plugins: [createShellI18n({ locale: 'en' })] } });
  return { wrapper, pressed };
}

describe('the row actions of a DataTable, for the tests of a page', () => {
  it('lists what a row offers: its buttons, then its «⋮», never what is hidden for it', () => {
    const { wrapper } = page();
    expect(offeredRowActions(wrapper, 'r1')).toEqual(['open', 'edit', 'pay', 'lock', 'delete']);
    expect(offeredRowActions(wrapper, 'r2')).toEqual(['open', 'edit', 'lock', 'delete']);
    expect(offeredRowActions(wrapper, 'nope')).toEqual([]);
  });

  it('presses a button as the person would, and an action of the menu as the menu would', async () => {
    const { wrapper, pressed } = page();
    await pressRowAction(wrapper, 'r1', 'edit');
    await pressRowAction(wrapper, 'r1', 'delete');
    expect(pressed.value).toEqual(['edit:r1', 'delete:r1']);
  });

  it('a disabled action does nothing, as on screen', async () => {
    const { wrapper, pressed } = page();
    await pressRowAction(wrapper, 'r1', 'lock');
    expect(pressed.value).toEqual([]);
  });

  it('an action the row does not offer is a mistake of the test', async () => {
    const { wrapper } = page();
    await expect(pressRowAction(wrapper, 'r2', 'pay')).rejects.toThrow('r2 offers no «pay»');
  });
});

describe('@erplora/ui/testing/data-table', () => {
  it('is a package entry point of its own, apart from the Node-only helpers', async () => {
    const pkg = (await import('../../package.json')).default as { exports: Record<string, string> };
    expect(pkg.exports['./testing/data-table']).toBe('./src/testing/dataTable.ts');
  });
});
