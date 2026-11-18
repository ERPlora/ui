import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import type { DataTableAction } from './types';
import { useRowMenu } from './useRowMenu';

type Row = { id: string; name: string };
const edit: DataTableAction<Row> = { id: 'edit', label: 'Edit' };
const remove: DataTableAction<Row> = { id: 'delete', label: 'Delete' };

function setup() {
  const rows = ref<Row[]>([{ id: 'a', name: 'Old name' }]);
  const offered = ref<DataTableAction<Row>[]>([edit, remove]);
  const run = vi.fn();
  const menu = useRowMenu<Row>({ rows: () => rows.value, keyOf: (row) => row.id, menuOf: () => offered.value, run });
  return { ...menu, rows, offered, run };
}
const tap = () => ({ stopPropagation: vi.fn() }) as unknown as Event;

describe('useRowMenu', () => {
  it('opens for a row, beside the tap, without the tap reaching the row', () => {
    const m = setup();
    const event = tap();
    m.openFor(event, m.rows.value[0]);
    expect(m.open.value).toBe(true);
    expect(m.event.value).toBe(event);
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(m.actions.value).toEqual([edit, remove]);
  });

  it('reads its row again by key: a refreshed row is the one it acts on', () => {
    const m = setup();
    m.openFor(tap(), m.rows.value[0]);
    m.rows.value = [{ id: 'a', name: 'New name' }];
    m.pick(edit);
    expect(m.run).toHaveBeenCalledWith(edit, { id: 'a', name: 'New name' });
    expect(m.open.value).toBe(false);
  });

  it('closes when nothing is left to offer (the box widened and every action is a button)', async () => {
    const m = setup();
    m.openFor(tap(), m.rows.value[0]);
    await flushPromises();
    m.offered.value = [];
    await flushPromises();
    expect(m.open.value).toBe(false);
  });

  it('without a row there is nothing to offer or run', () => {
    const m = setup();
    expect(m.actions.value).toEqual([]);
    m.pick(edit);
    expect(m.run).not.toHaveBeenCalled();
  });
});
