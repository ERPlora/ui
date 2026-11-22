import { afterEach, describe, expect, it, vi } from 'vitest';
import { reactive, ref } from 'vue';

import type { DataTableColumn } from './types';
import { useVisibleColumns } from './useVisibleColumns';
import { clearLayout, mountTable, playBackLayout, setBoxWidth, settle } from './__tests__/harness';

type Row = { id: string };
const COLUMNS: DataTableColumn<Row>[] = [
  { key: 'name', label: 'Name' },
  { key: 'notes', label: 'Notes', hidden: true },
  { key: 'zone', label: 'Zone', priority: 'low' },
];

function setup() {
  const props = reactive({ columns: COLUMNS });
  const lowHidden = ref(false);
  const cardsOn = ref(false);
  const picked = vi.fn();
  const c = useVisibleColumns<Row>(props, { lowHidden: () => lowHidden.value, cardsOn: () => cardsOn.value, picked });
  return { ...c, props, lowHidden, cardsOn, picked };
}
const keys = (columns: readonly DataTableColumn<Row>[]) => columns.map((column) => column.key);

describe('useVisibleColumns', () => {
  it('shows each column as its `hidden` says until the person picks otherwise, and tells the page the pick', () => {
    const c = setup();
    expect(keys(c.visibleColumns.value)).toEqual(['name', 'zone']);
    c.onColumnsPicked(['notes', 'zone']);
    expect(keys(c.visibleColumns.value)).toEqual(['notes', 'zone']);
    expect(c.picked).toHaveBeenCalledExactlyOnceWith(['notes', 'zone']);
  });

  it('follows the columns the page hands', () => {
    const c = setup();
    c.props.columns = [COLUMNS[1], COLUMNS[0]];
    expect(keys(c.visibleColumns.value)).toEqual(['name']);
  });

  it('the list leaves out the low columns while the box hides them; the cards and the chooser of the cards keep them', () => {
    const c = setup();
    expect(keys(c.yieldingColumns.value)).toEqual(['zone']);
    c.lowHidden.value = true;
    expect([keys(c.listColumns.value), keys(c.shownColumns.value)]).toEqual([['name'], ['name']]);
    c.cardsOn.value = true;
    expect([keys(c.listColumns.value), keys(c.shownColumns.value)]).toEqual([['name'], ['name', 'zone']]);
    c.lowHidden.value = false;
    c.cardsOn.value = false;
    expect([keys(c.listColumns.value), keys(c.shownColumns.value)]).toEqual([['name', 'zone'], ['name', 'zone']]);
  });

  it('a pick records only what changed against what is painted: a column the box hid and nobody touched stays the box’s', () => {
    const c = setup();
    c.lowHidden.value = true;
    c.onColumnsPicked([]);
    expect([...c.columnChoice.value]).toEqual([['name', false]]);
    expect(keys(c.yieldingColumns.value)).toEqual(['zone']);
    c.lowHidden.value = false;
    expect(keys(c.listColumns.value)).toEqual(['zone']);
  });

  it('each pick adds to the ones before it', () => {
    const c = setup();
    c.onColumnsPicked(['name', 'notes', 'zone']);
    c.onColumnsPicked(['notes', 'zone']);
    expect([...c.columnChoice.value]).toEqual([['notes', true], ['name', false]]);
    expect(keys(c.visibleColumns.value)).toEqual(['notes', 'zone']);
  });

  it('a low column the person brings back by hand no longer yields to the box', () => {
    const c = setup();
    c.lowHidden.value = true;
    c.onColumnsPicked(['name', 'zone']);
    expect([...c.columnChoice.value]).toEqual([['zone', true]]);
    expect(keys(c.yieldingColumns.value)).toEqual([]);
    expect(keys(c.listColumns.value)).toEqual(['name', 'zone']);
  });
});

describe('useVisibleColumns inside the table', () => {
  afterEach(clearLayout);

  it('in the cards, which keep the low columns the list gave up, the chooser marks them picked', async () => {
    // A list that never fits its box: the table gives its low column up, folds its action, then turns into cards.
    playBackLayout(40, (el) => (el.classList.contains('data-table__scroll') ? 10_000 : 0));
    setBoxWidth(700);
    const open = { id: 'open', label: 'Open', icon: 'open-outline' };
    const t = mountTable({ rows: [{ id: 'a' }], columns: COLUMNS, actions: [open], views: ['table', 'cards'] });
    await settle();
    const chooser = t.element.querySelector('.data-table__columns-select') as HTMLElement & { value?: string[] };
    expect(t.element.querySelector('.data-table__cards')).not.toBeNull();
    expect(chooser.value).toEqual(['name', 'zone']);
  });
});
