// `@erplora/ui/testing/data-table`: what the test of a page needs to read and press the row actions of its
// DataTable, wherever they are on screen (a button, or inside «⋮», which Ionic presents only in a real browser).
import type { VueWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';

import DataTable from '../components/DataTable/DataTable.vue';
import DataTableRowActions from '../components/DataTable/DataTableRowActions.vue';
import type { DataTableAction, DataTableActionCell } from '../components/DataTable/types';

type Cell = { items: DataTableActionCell<object>['items']; menu: DataTableAction<object>[]; row: object };
type Found = { wrapper: VueWrapper; cell: Cell };

function actionsOf(wrapper: VueWrapper, rowId: string): Found | undefined {
  const found = wrapper
    .findAllComponents(DataTableRowActions)
    .find((c) => (c.props() as unknown as { rowId: string }).rowId === rowId);
  return found ? { wrapper: found as VueWrapper, cell: found.props() as unknown as Cell } : undefined;
}

/** The ids of the actions a row offers: its buttons, then what its «⋮» holds. */
export function offeredRowActions(wrapper: VueWrapper, rowId: string): string[] {
  const found = actionsOf(wrapper, rowId);
  if (!found) return [];
  return [...found.cell.items.map((slot) => slot.action.id), ...found.cell.menu.map((action) => action.id)];
}

/** Presses a row action: its button as the person would, or the item of «⋮» as the menu would. */
export async function pressRowAction(wrapper: VueWrapper, rowId: string, actionId: string): Promise<void> {
  const found = actionsOf(wrapper, rowId);
  const index = found?.cell.items.findIndex((slot) => slot.action.id === actionId) ?? -1;
  if (found && index >= 0) {
    await found.wrapper.findAll('ion-button')[index].trigger('click');
    return;
  }
  const action = found?.cell.menu.find((each) => each.id === actionId);
  if (!found || !action) throw new Error(`${rowId} offers no «${actionId}»`);
  const row = found.cell.row;
  if (action.loading?.(row) === true || action.disabled?.(row) === true) return;
  wrapper.findComponent(DataTable).vm.$emit('action', { actionId, row });
  await nextTick();
}
