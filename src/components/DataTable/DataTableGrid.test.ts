import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';

import { ionIconSrc } from '../../shell/icons';
import { createShellI18n } from '../../shell/i18n';
import { clearLayout, dataRows, mountTable, playBackLayout, settle, text } from './__tests__/harness';
import DataTableGrid from './DataTableGrid.vue';
import { DATA_TABLE_ICONS } from './model';
import type { DataTableAction, DataTableColumn } from './types';

afterEach(() => {
  document.body.replaceChildren();
});

type Row = { id: string; name: string; city: string };
type Ionic = HTMLElement & Record<string, unknown>;

const COLUMNS: DataTableColumn<Row>[] = [
  { key: 'name', label: 'Name' },
  { key: 'city', label: 'City', align: 'right' },
];
const ROWS: Row[] = [
  { id: 'a', name: 'Ana', city: 'Vigo' },
  { id: 'b', name: 'Bea', city: 'Lugo' },
];
const EDIT: DataTableAction<Row> = { id: 'edit', label: 'Edit', icon: 'create-outline' };
const DROP: DataTableAction<Row> = { id: 'drop', label: 'Drop', icon: 'trash-outline' };
const SEND: DataTableAction<Row> = { id: 'send', label: 'Send', icon: 'send-outline' };

/** What the table's sort says of every column: none sortable, none sorted. */
const UNSORTED = {
  isSortable: () => false,
  isSorted: () => false,
  caretIcon: () => DATA_TABLE_ICONS.sortNone,
  ariaSort: () => undefined,
};

/** The list as the table paints it with nothing turned on: each test turns on what it reads. */
const AT_REST = {
  visible: ROWS,
  rows: ROWS,
  columns: COLUMNS,
  template: '120px 1fr',
  xOverflow: false,
  sorting: UNSORTED,
  selectable: false,
  allSelected: false,
  selection: new Set<string>(),
  keyOf: (row: Row) => row.id,
  rowId: (row: Row, index: number) => `${row.id}${index}`,
  listActions: () => ({ items: [], menu: [] }),
  hasActions: false,
  rowActionsCollapsed: false,
  actionsLabelFits: true,
  rowClickable: false,
  testid: 'bills',
};

function mountGrid(props: Record<string, unknown> = {}, options: { locale?: 'en' | 'es'; slots?: Record<string, string> } = {}) {
  return mount(DataTableGrid, {
    props: { ...AT_REST, ...props } as never,
    slots: options.slots,
    global: { plugins: [createShellI18n({ locale: options.locale ?? 'en' })] },
    attachTo: document.body,
  });
}

type Grid = ReturnType<typeof mountGrid>;
const head = (g: Grid) => g.element.querySelector('.data-table__row--head') as HTMLElement;
const heads = (g: Grid) => [...head(g).querySelectorAll<HTMLElement>('[role="columnheader"]')];
const rows = (g: Grid) => [...(g.element as HTMLElement).querySelectorAll<HTMLElement>('.data-table__row--data')];
const actionsHead = (g: Grid) => head(g).querySelector('.data-table__cell--actions > span');
/** An ion-button hands its aria-* to its native button: that one first, then the host. */
const aria = (button: Element | null, name: string) => button?.shadowRoot?.querySelector('button')?.getAttribute(name) ?? button?.getAttribute(name);

describe('DataTableGrid', () => {
  it('heads the list with a labelled head per column, aligned and pinned as the column says, on the grid of its rows', () => {
    const columns = [...COLUMNS, { key: 'state', label: 'State', align: 'center', pinned: 'end' }];
    const g = mountGrid({ columns });
    expect(g.element.getAttribute('role')).toBeNull();
    expect(g.element.querySelector('.data-table__grid')?.getAttribute('role')).toBe('table');
    expect(head(g).getAttribute('role')).toBe('row');
    expect(heads(g).map((cell) => text(cell))).toEqual(['Name', 'City', 'State']);
    expect(heads(g).map((cell) => cell.querySelector('span')?.getAttribute('title'))).toEqual(['Name', 'City', 'State']);
    expect(heads(g).map((cell) => [...cell.classList].filter((name) => name !== 'data-table__cell' && name !== 'data-table__cell--header'))).toEqual([
      [],
      ['data-table__cell--right'],
      ['data-table__cell--center', 'data-table__cell--pinned'],
    ]);
    expect([head(g), ...rows(g)].map((row) => row.style.gridTemplateColumns)).toEqual(['120px 1fr', '120px 1fr', '120px 1fr']);
  });

  it('a sortable head shows its caret and says its order; a click on any head hands that column over', async () => {
    const sorting = {
      isSortable: (column: DataTableColumn<Row>) => column.key === 'name',
      isSorted: (column: DataTableColumn<Row>) => column.key === 'name',
      caretIcon: () => DATA_TABLE_ICONS.sortAsc,
      ariaSort: (column: DataTableColumn<Row>) => (column.key === 'name' ? 'ascending' : undefined),
    };
    const g = mountGrid({ sorting });
    const [name, city] = heads(g);
    expect([name.classList.contains('data-table__cell--sortable'), city.classList.contains('data-table__cell--sortable')]).toEqual([true, false]);
    expect([name.getAttribute('aria-sort'), city.getAttribute('aria-sort')]).toEqual(['ascending', null]);
    expect(name.querySelector('.data-table__caret')?.classList.contains('data-table__caret--active')).toBe(true);
    expect((name.querySelector('.data-table__caret ion-icon') as Ionic).icon).toBe(ionIconSrc(DATA_TABLE_ICONS.sortAsc));
    expect(city.querySelector('.data-table__caret')).toBeNull();
    city.click();
    name.click();
    await settle();
    expect(g.emitted('sort')).toEqual([[COLUMNS[1]], [COLUMNS[0]]]);
  });

  it('a caret not sorted is there but dim', () => {
    const g = mountGrid({ sorting: { ...UNSORTED, isSortable: () => true } });
    const caret = heads(g)[0].querySelector('.data-table__caret');
    expect([caret?.classList.contains('data-table__caret--active'), caret?.querySelector('ion-icon')?.icon]).toEqual([false, ionIconSrc(DATA_TABLE_ICONS.sortNone)]);
  });

  it('«Select all» only on a selectable list: ticked when the table says so, named, and handing over a tick', async () => {
    expect(mountGrid().element.querySelector('.data-table__select-cell')).toBeNull();
    const g = mountGrid({ selectable: true, allSelected: true });
    const all = head(g).querySelector('.data-table__select-cell > ion-checkbox') as Ionic;
    expect([all.checked, all.getAttribute('aria-label')]).toEqual([true, 'Select all']);
    all.dispatchEvent(new CustomEvent('ionChange', { detail: { checked: false } }));
    await settle();
    expect(g.emitted('selectAll')).toEqual([[]]);
    await g.setProps({ allSelected: false });
    expect(all.checked).toBe(false);
  });

  it('ticks the rows the table has selected, by their key, and hands over the row ticked', async () => {
    const g = mountGrid({ selectable: true, selection: new Set(['b']) });
    expect(rows(g).map((row) => row.classList.contains('data-table__row--selected'))).toEqual([false, true]);
    const boxes = rows(g).map((row) => row.querySelector('.data-table__select-cell > ion-checkbox') as Ionic);
    expect(boxes.map((box) => [box.checked, box.getAttribute('aria-label')])).toEqual([[false, 'Select row'], [true, 'Select row']]);
    boxes[0].dispatchEvent(new CustomEvent('ionChange', { detail: { checked: true } }));
    await settle();
    expect(g.emitted('select')).toEqual([['a0']]);
  });

  it('the actions head is painted while the actions fit, and only named for assistive tech when they fold or its label does not fit', async () => {
    expect(head(mountGrid()).querySelector('.data-table__cell--actions')).toBeNull();
    const g = mountGrid({ hasActions: true });
    const cell = head(g).querySelector('.data-table__cell--actions');
    expect([cell?.getAttribute('role'), cell?.classList.contains('data-table__cell--pinned'), text(actionsHead(g))]).toEqual(['columnheader', true, 'Actions']);
    expect(actionsHead(g)?.classList.contains('data-table__sr-only')).toBe(false);
    await g.setProps({ rowActionsCollapsed: true });
    expect(actionsHead(g)?.classList.contains('data-table__sr-only')).toBe(true);
    await g.setProps({ rowActionsCollapsed: false, actionsLabelFits: false });
    expect(actionsHead(g)?.classList.contains('data-table__sr-only')).toBe(true);
  });

  it('paints only the rows on screen, each under the key the table gives it, with the actions the table lays out for it', () => {
    const listActions = (row: Row) => ({ items: [{ action: EDIT }], menu: row.id === 'b' ? [DROP] : [] });
    const g = mountGrid({ visible: [ROWS[1]], hasActions: true, listActions });
    expect(rows(g).map((row) => [row.dataset.id, row.dataset.testid])).toEqual([['b0', 'bills-row']]);
    expect(text(rows(g)[0])).toContain('Bea');
    const buttons = [...rows(g)[0].querySelectorAll('.data-table__actions > ion-button')];
    expect(buttons.map((button) => button.getAttribute('data-testid'))).toEqual(['bills-row-b0-edit', 'bills-row-b0-menu']);
    expect(aria(buttons[1], 'aria-label')).toBe('More actions');
  });

  it('hands over what a row asks for: open it, run an action, open its «⋮» or flip its switch', async () => {
    const state = { key: 'live', label: 'Live', toggle: { checked: () => true, label: () => 'Turn off' } };
    const listActions = () => ({ items: [{ action: EDIT }], menu: [DROP] });
    const g = mountGrid({ columns: [...COLUMNS, state], hasActions: true, listActions, rowClickable: true });
    const [first] = rows(g);
    first.click();
    (first.querySelector('[data-testid="bills-row-a0-edit"]') as HTMLElement).click();
    (first.querySelector('[data-testid="bills-row-a0-menu"]') as HTMLElement).click();
    first.querySelector('ion-toggle')?.dispatchEvent(new CustomEvent('ionChange', { detail: { checked: false } }));
    await settle();
    expect(g.emitted('open')).toEqual([[ROWS[0]]]);
    expect(g.emitted('action')).toEqual([[{ action: EDIT, row: ROWS[0] }]]);
    expect(g.emitted('menu')?.map(([event, row]) => [event instanceof Event, row])).toEqual([[true, ROWS[0]]]);
    expect(g.emitted('toggle')).toEqual([[{ column: 'live', row: ROWS[0], checked: false }]]);
  });

  it('paints the page’s own cell of a column and its `row-actions` in each row', () => {
    const columns = [{ key: 'name', label: 'Name', cell: 'who' }, COLUMNS[1]];
    const slots = {
      who: '<template #who="{ row, value, column }"><b class="own-cell">{{ column.label }}:{{ value }}:{{ row.id }}</b></template>',
      'row-actions': '<template #row-actions="{ row }"><i class="own-action">{{ row.id }}</i></template>',
    };
    const g = mountGrid({ columns, hasActions: true }, { slots });
    expect(rows(g).map((row) => text(row.querySelector('.own-cell')))).toEqual(['Name:Ana:a', 'Name:Bea:b']);
    expect(rows(g).map((row) => text(row.querySelector('.data-table__cell--actions .own-action')))).toEqual(['a', 'b']);
  });

  it('shades its pinned column only while the list is wider than its box', async () => {
    const g = mountGrid();
    expect(g.element.className).toBe('data-table__scroll');
    await g.setProps({ xOverflow: true });
    expect(g.element.className).toBe('data-table__scroll data-table__scroll--overflow');
  });

  it('speaks Spanish', () => {
    const g = mountGrid({ selectable: true, hasActions: true, listActions: () => ({ items: [], menu: [DROP] }) }, { locale: 'es' });
    expect(head(g).querySelector('ion-checkbox')?.getAttribute('aria-label')).toBe('Seleccionar todo');
    expect(text(actionsHead(g))).toBe('Acciones');
    expect(rows(g)[0].querySelector('ion-checkbox')?.getAttribute('aria-label')).toBe('Seleccionar fila');
    expect(aria(rows(g)[0].querySelector('[data-testid="bills-row-a0-menu"]'), 'aria-label')).toBe('Más acciones');
  });
});

describe('DataTableGrid inside the table', () => {
  const headLabel = (t: ReturnType<typeof mountTable>) => t.element.querySelector('.data-table__row--head .data-table__cell--actions > span');
  const buttons = (t: ReturnType<typeof mountTable>) => [...dataRows(t)[0].querySelectorAll('.data-table__actions > ion-button')];

  afterEach(clearLayout);

  it('speaks with the table’s own texts in its heads and its rows', async () => {
    const labels = { selectAll: 'Tick every bill', actions: 'Tools', selectRow: 'Tick this bill', moreActions: 'Other tools' };
    const t = mountTable({ rows: ROWS, columns: COLUMNS, selectable: true, actions: [EDIT, DROP, SEND], testid: 'bills', labels }, { attachTo: document.body });
    await settle();
    const checkboxes = [...t.element.querySelectorAll('.data-table__select-cell > ion-checkbox')].map((box) => box.getAttribute('aria-label'));
    expect([checkboxes[0], checkboxes[1], text(headLabel(t))]).toEqual(['Tick every bill', 'Tick this bill', 'Tools']);
    expect(aria(t.element.querySelector('[data-testid="bills-row-a-menu"]'), 'aria-label')).toBe('Other tools');
  });

  it('names the actions head only for assistive tech once the box folds the row actions into «⋮»', async () => {
    // The list needs more than its box while a row shows more than its pinned button and «⋮».
    playBackLayout(40, (el, box) => (el.classList.contains('data-table__scroll') ? box + (el.querySelectorAll('.data-table__actions > ion-button').length > 2 ? 100 : 0) : 0));
    const t = mountTable({ rows: [ROWS[0]], columns: COLUMNS, actions: [{ ...EDIT, pinned: true }, DROP, SEND] });
    await settle();
    expect(buttons(t)).toHaveLength(2);
    expect(headLabel(t)?.classList.contains('data-table__sr-only')).toBe(true);
  });

  it('names the actions head only for assistive tech when «Actions» does not fit its column, with the actions unfolded', async () => {
    const t = mountTable({ rows: [ROWS[0]], columns: COLUMNS, actions: [EDIT] });
    await settle();
    const cell = t.element.querySelector('.data-table__row--head .data-table__cell--actions') as HTMLElement;
    Object.defineProperty(cell, 'clientWidth', { configurable: true, get: () => 40 });
    Object.defineProperty(headLabel(t), 'scrollWidth', { configurable: true, get: () => 63 });
    await t.setProps({ rows: [{ ...ROWS[0] }] });
    await settle();
    expect(buttons(t).map((button) => button.getAttribute('aria-label'))).toEqual(['Edit']);
    expect(headLabel(t)?.classList.contains('data-table__sr-only')).toBe(true);
  });
});
