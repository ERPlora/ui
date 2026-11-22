import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { h, ref } from 'vue';

import { createShellI18n } from '../../shell/i18n';
import DataTable from './DataTable.vue';
import { byTestId, cards, click, mountTable, PopoverStub, settle, text, viewport } from './__tests__/harness';

type Row = Record<string, unknown>;

beforeEach(() => {
  viewport(false);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

const actionCells = (t: ReturnType<typeof mountTable>) =>
  [...t.element.querySelectorAll('.data-table__row--data .data-table__cell--actions')] as HTMLElement[];
const buttons = (cell: Element | undefined) => [...(cell?.querySelectorAll('ion-button') ?? [])] as HTMLElement[];
const menuItems = (t: ReturnType<typeof mountTable>) => [...t.element.querySelectorAll('.data-table__row-menu ion-item')] as HTMLElement[];
const itemLabel = (item: HTMLElement) => item.querySelector('ion-label')?.innerHTML.trim();

async function layOut(t: ReturnType<typeof mountTable>, container: number, content: number): Promise<void> {
  const scroll = t.element.querySelector('.data-table__scroll') as HTMLElement;
  Object.defineProperty(scroll, 'clientWidth', { configurable: true, get: () => container });
  Object.defineProperty(scroll, 'scrollWidth', { configurable: true, get: () => content });
  window.dispatchEvent(new Event('resize'));
  await settle();
}

describe('row actions keep their own label and row', () => {
  const rows = [{ id: '1', total: 100, refunded: 30 }, { id: '2', total: 50, refunded: 0 }];
  const refund = { id: 'refund', label: (row: Row) => `Refund the rest (${Number(row.total) - Number(row.refunded)} €)` };

  it('paints a different label per row in the list and the cards', async () => {
    const props = { rows, columns: [{ key: 'total', label: 'Total' }], actions: [refund], testid: 'invoice' };
    const list = mountTable(props);
    const cardsView = mountTable({ ...props, views: true, defaultView: 'cards' });
    await settle();
    expect(actionCells(list).map((cell) => text(buttons(cell)[0]))).toEqual(['Refund the rest (70 €)', 'Refund the rest (50 €)']);
    expect(cards(cardsView).map((card) => text(card.querySelector('.data-table__card-actions ion-button')))).toEqual([
      'Refund the rest (70 €)',
      'Refund the rest (50 €)',
    ]);
  });

  it('uses that label as accessible name and emits its id with that row', async () => {
    const t = mountTable({ rows, columns: [{ key: 'total', label: 'Total' }], actions: [{ ...refund, icon: 'arrow-undo-outline' }], testid: 'invoice' });
    await settle();
    const second = buttons(actionCells(t)[1])[0];
    expect(second.getAttribute('aria-label')).toBe('Refund the rest (50 €)');
    expect(second.getAttribute('title')).toBe('Refund the rest (50 €)');
    await click(second);
    expect(t.emitted('action')).toEqual([[{ actionId: 'refund', row: rows[1] }]]);
  });
});

describe('action state and tone', () => {
  const busy = (extra: Row = {}) =>
    mountTable({
      rows: [{ id: '1', name: 'Invoice' }],
      columns: [{ key: 'name', label: 'Name' }],
      testid: 'invoice',
      actions: [{ id: 'sync', label: 'Sync', icon: 'sync-outline', color: 'danger', loading: () => true, ...extra }],
    });

  it('paints from the token; busy, an icon button turns into a spinner, disabled and still named', async () => {
    const t = busy();
    await settle();
    const button = byTestId(t, 'invoice-row-1-sync')[0] as HTMLElement & { disabled?: boolean };
    expect(button.getAttribute('style')).toContain('--color: var(--ion-color-danger, #c5000f)');
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.querySelector('ion-spinner[slot="icon-only"]')).not.toBeNull();
    expect(text(button)).toBe('');
    expect(button.getAttribute('aria-label')).toBe('Sync');
  });

  it('busy, a labelled action keeps its text beside the spinner', async () => {
    const t = busy({ showLabel: true });
    await settle();
    const button = byTestId(t, 'invoice-row-1-sync')[0] as HTMLElement;
    expect(button.querySelector('ion-spinner[slot="start"]')).not.toBeNull();
    expect(text(button)).toBe('Sync');
  });

  it('keeps a disabled action disabled in the menu', async () => {
    const t = mountTable({
      rows: [{ id: '1', name: 'Invoice' }],
      columns: [{ key: 'name', label: 'Name' }],
      testid: 'invoice',
      actions: [
        { id: 'open', label: 'Open', pinned: true },
        { id: 'edit', label: 'Edit' },
        { id: 'delete', label: 'Delete', disabled: () => true },
      ],
    });
    await settle();
    await click(byTestId(t, 'invoice-row-1-menu')[0]);
    const item = menuItems(t)[0] as HTMLElement & { disabled?: boolean };
    expect(item.disabled).toBe(true);
    await click(item);
    expect(t.emitted('action')).toBeUndefined();
  });
});

describe('hidden actions leave no phantom controls', () => {
  const rows: Row[] = [{ id: 'issued' }, { id: 'paid' }, { id: 'voided', locked: true }];
  const actions = [
    { id: 'view', label: 'View', pinned: true },
    { id: 'refund', label: (row: Row) => `Refund ${(row.refund as { amount: string }).amount}`, hidden: (row: Row) => !row.refund },
    { id: 'delete', label: 'Delete', hidden: (row: Row) => row.locked === true },
  ];
  const props = { rows, columns: [{ key: 'id', label: 'Invoice' }], actions, testid: 'invoice' };

  it('shows only the actions available to each row', async () => {
    const t = mountTable({ ...props, rows: [{ ...rows[0], refund: { amount: '10 €' } }, rows[1], rows[2]] });
    await settle();
    expect(actionCells(t).map((cell) => buttons(cell).map((button) => button.getAttribute('data-testid')))).toEqual([
      ['invoice-row-issued-view', 'invoice-row-issued-refund', 'invoice-row-issued-menu'],
      ['invoice-row-paid-view', 'invoice-row-paid-delete'],
      ['invoice-row-voided-view'],
    ]);
    expect(t.element.querySelectorAll('[data-slot-for]')).toHaveLength(0);
  });

  it('does not paint an action hidden on every row, and recovers it when a row offers it', async () => {
    const t = mountTable({ ...props, rows: [rows[1]], actions: [actions[0], actions[1]] });
    await settle();
    expect(buttons(actionCells(t)[0])).toHaveLength(1);
    await t.setProps({ rows: [{ ...rows[0], refund: { amount: '10 €' } }] });
    await settle();
    expect(text(byTestId(t, 'invoice-row-issued-refund')[0])).toBe('Refund 10 €');
  });
});

describe('the actions column still fits by measurement', () => {
  it('reserves max-content before measuring and then the primary button and menu width', async () => {
    const t = mountTable({
      rows: [{ id: '1', name: 'Invoice' }],
      columns: [{ key: 'name', label: 'Name' }],
      actions: [{ id: 'open', label: 'Open', pinned: true }, { id: 'delete', label: 'Delete' }],
    });
    await settle();
    const header = t.element.querySelector('.data-table__row--head') as HTMLElement;
    expect(header.style.gridTemplateColumns.split(' ').at(-1)).toBe('max-content');
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const width = this.localName === 'ion-button' ? 44 : 0;
      return { width, height: 44, top: 0, left: 0, right: width, bottom: 44, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    });
    await t.setProps({ rows: [{ id: '2', name: 'Other' }] });
    await settle();
    expect(header.style.gridTemplateColumns.split(' ').at(-1)).toBe('88px');
  });

  it('names the actions header for assistive tech when its label does not fit', async () => {
    const t = mountTable({ rows: [{ id: '1', name: 'Invoice' }], columns: [{ key: 'name', label: 'Name' }], actions: [{ id: 'open', label: 'Open' }] });
    await settle();
    const cell = t.element.querySelector('.data-table__row--head .data-table__cell--actions') as HTMLElement;
    Object.defineProperty(cell, 'clientWidth', { configurable: true, get: () => 40 });
    const label = cell.querySelector('span') as HTMLElement;
    Object.defineProperty(label, 'scrollWidth', { configurable: true, get: () => 63 });
    await layOut(t, 700, 800);
    expect(text(cell.querySelector('.data-table__sr-only'))).toBe('Actions');
  });
});

describe('the row menu keeps the action contract', () => {
  const rows = [{ id: '1', name: 'One' }, { id: '2', name: 'Two' }];
  const actions = [
    { id: 'open', label: 'Open', pinned: true },
    { id: 'edit', label: 'Edit', icon: 'create-outline' },
    { id: 'archive', label: 'Archive', icon: 'archive-outline' },
    { id: 'delete', label: 'Delete', icon: 'trash-outline', color: 'danger' },
  ];

  it('two buttons per row; the menu offers the rest with icon, label and tone, and emits the row that opened it', async () => {
    const t = mountTable({ rows, columns: [{ key: 'name', label: 'Name' }], actions, testid: 'record' });
    await settle();
    expect(buttons(actionCells(t)[1]).map((button) => button.getAttribute('data-testid'))).toEqual([
      'record-row-2-open',
      'record-row-2-edit',
      'record-row-2-menu',
    ]);
    await click(byTestId(t, 'record-row-2-menu')[0]);
    expect(menuItems(t).map(itemLabel)).toEqual(['Archive', 'Delete']);
    expect(menuItems(t).every((item) => item.querySelector('ion-icon[slot="start"]'))).toBe(true);
    expect(menuItems(t)[1].querySelector('ion-label')?.getAttribute('style')).toContain('color: var(--ion-color-danger, #c5000f)');
    await click(menuItems(t)[0]);
    expect(t.emitted('action')).toEqual([[{ actionId: 'archive', row: rows[1] }]]);
    expect(menuItems(t)).toHaveLength(0);
  });

  it('keeps the action hook in one place, on the button or on its menu item', async () => {
    const t = mountTable({ rows, columns: [{ key: 'name', label: 'Name' }], actions, testid: 'record' });
    await settle();
    expect(byTestId(t, 'record-row-1-open')[0].tagName).toBe('ION-BUTTON');
    expect(byTestId(t, 'record-row-1-delete')).toHaveLength(0);
    await click(byTestId(t, 'record-row-1-menu')[0]);
    expect(byTestId(t, 'record-row-1-delete')[0].tagName).toBe('ION-ITEM');
  });
});

describe('custom controls and the default primary action', () => {
  it('keeps the row-actions slot in the list and the cards without opening the record', async () => {
    const slots = { 'row-actions': '<template #row-actions="{ row }"><button class="own">Go {{ row.id }}</button></template>' };
    const props = { rows: [{ id: '1', name: 'One' }], columns: [{ key: 'name', label: 'Name' }], rowClickable: true };
    const list = mountTable(props, { slots });
    const cardsView = mountTable({ ...props, views: true, defaultView: 'cards' }, { slots });
    await settle();
    await click(list.element.querySelector('.data-table__cell--actions .own'));
    expect(list.emitted('rowClick')).toBeUndefined();
    expect(text(cardsView.element.querySelector('.data-table__card-actions .own'))).toBe('Go 1');
  });

  // Slots are not reactive: a page that starts giving one later (a `v-if` on its template) is only seen if the
  // table reads its slots on every render, not once in a computed.
  it('a row-actions or card slot the page gives after the first paint reaches the list and the cards', async () => {
    const given = ref(false);
    const props = { rows: [{ id: '1', name: 'One' }], columns: [{ key: 'name', label: 'Name' }], actions: [{ id: 'edit', label: 'Edit' }], views: true };
    const own = {
      'row-actions': ({ row }: { row: Row }) => h('b', { class: 'own' }, `Go ${row.id}`),
      card: ({ row }: { row: Row }) => h('i', { class: 'mine' }, `Card ${row.id}`),
    };
    const page = (defaultView: string) =>
      mount({ render: () => h(DataTable as never, { ...props, defaultView }, given.value ? own : {}) }, {
        global: { plugins: [createShellI18n({ locale: 'en' })], stubs: { IonPopover: PopoverStub } },
      });
    const list = page('list');
    const cardsView = page('cards');
    await settle();
    given.value = true;
    await settle();
    expect(text(list.element.querySelector('.data-table__cell--actions .own'))).toBe('Go 1');
    expect(text(cardsView.element.querySelector('.data-table__card-actions .own'))).toBe('Go 1');
    expect(text(cardsView.element.querySelector('.mine'))).toBe('Card 1');
  });

  it('the list keeps two buttons; the card keeps its main one, and «⋮» holds the rest', async () => {
    const props = {
      rows: [{ id: '1', name: 'Invoicing' }],
      columns: [{ key: 'name', label: 'App' }],
      actions: [
        { id: 'open', label: 'Open', icon: 'open-outline', pinned: true },
        { id: 'toggle', label: 'Turn off' },
        { id: 'delete', label: 'Delete', menuOnly: true },
      ],
      testid: 'apps',
    };
    const list = mountTable(props);
    const cardsView = mountTable({ ...props, views: true, defaultView: 'cards' });
    await settle();
    const inline = (t: ReturnType<typeof mountTable>) =>
      [...t.element.querySelectorAll('[data-testid="apps-row"] ion-button')].map((button) => button.getAttribute('data-testid'));
    expect(inline(list)).toEqual(['apps-row-1-open', 'apps-row-1-toggle', 'apps-row-1-menu']);
    expect(inline(cardsView)).toEqual(['apps-row-1-open', 'apps-row-1-menu']);
    expect(text(byTestId(list, 'apps-row-1-open')[0]), 'icon-only in the list').toBe('');
    expect(text(byTestId(cardsView, 'apps-row-1-open')[0]), 'with its text on the card').toBe('Open');
    await click(byTestId(cardsView, 'apps-row-1-menu')[0]);
    expect(menuItems(cardsView).map(itemLabel)).toEqual(['Turn off', 'Delete']);
  });
});

describe('a column with a switch', () => {
  const rows = [{ id: 'invoice', name: 'Invoicing', on: true }];
  const columns = [
    { key: 'name', label: 'App' },
    { key: 'state', label: 'State', toggle: { checked: (row: Row) => row.on === true, label: (row: Row) => `Turn ${String(row.name)} off` } },
  ];

  it('the list and the cards emit `toggle` with the column, the row and the state asked for', async () => {
    const list = mountTable({ rows, columns, testid: 'apps' });
    const cardsView = mountTable({ rows, columns, testid: 'apps', views: true, defaultView: 'cards' });
    await settle();
    for (const t of [list, cardsView]) {
      const toggle = t.element.querySelector('[data-testid="apps-row"] ion-toggle') as HTMLElement;
      expect(toggle.getAttribute('aria-label')).toBe('Turn Invoicing off');
      toggle.dispatchEvent(new CustomEvent('ionChange', { detail: { checked: false } }));
      await settle();
      expect(t.emitted('toggle')).toEqual([[{ column: 'state', row: rows[0], checked: false }]]);
    }
    expect(cardsView.element.querySelector('.data-table__card-head ion-toggle')).not.toBeNull();
  });
});
