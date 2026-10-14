// DataTable row actions: per-row labels (#110), tones (#162), hidden per row (hub#2014) with gaps
// that keep the columns aligned (#240), the measured track (#121, #211) and the «…» fold (#122,
// #213). Cases ported from the Lit tests of OutfitKit's `ok-data-table`.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { byTestId, cards, click, dataRows, mountTable, settle, text, viewport } from './__tests__/harness';

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

/** happy-dom lays nothing out: the list is laid out at `container` px needing `content` px. */
async function layOut(t: ReturnType<typeof mountTable>, container: number, content: number): Promise<void> {
  const scroll = t.element.querySelector('.data-table__scroll') as HTMLElement;
  Object.defineProperty(scroll, 'clientWidth', { configurable: true, get: () => container });
  Object.defineProperty(scroll, 'scrollWidth', { configurable: true, get: () => content });
  window.dispatchEvent(new Event('resize'));
  await settle();
}

/** Lays the list out too narrow for its buttons, so they fold into «…» (#122). */
const fold = (t: ReturnType<typeof mountTable>) => layOut(t, 700, 796);

describe('a row action names itself, per row (#110)', () => {
  const ROWS = [{ id: '1', number: 'V-1000', total: 100, refunded: 30 }, { id: '2', number: 'V-1001', total: 50, refunded: 0 }];
  const remaining = (row: Row) => Number(row.total) - Number(row.refunded);
  const refund = { id: 'refund', label: (row: Row) => `Devolver el resto (${remaining(row)} €)` };

  it('a function label paints a different text on each row, in the list and in the cards', async () => {
    const list = mountTable({ rows: ROWS, columns: [{ key: 'number', label: 'Nº' }], actions: [refund] });
    const cardsView = mountTable({ rows: ROWS, columns: [{ key: 'number', label: 'Nº' }], actions: [refund], views: true, defaultView: 'cards' });
    await settle();
    expect(actionCells(list).map((c) => text(buttons(c)[0]))).toEqual(['Devolver el resto (70 €)', 'Devolver el resto (50 €)']);
    expect(cards(cardsView).map((c) => text(c.querySelector('.data-table__card-actions ion-button')))).toEqual([
      'Devolver el resto (70 €)',
      'Devolver el resto (50 €)',
    ]);
  });

  it('it is also the accessible name and the title of an icon-only action', async () => {
    const t = mountTable({ rows: ROWS, columns: [{ key: 'number', label: 'Nº' }], actions: [{ ...refund, icon: 'arrow-undo-outline' }] });
    await settle();
    const [first, second] = actionCells(t).map((c) => buttons(c)[0]);
    expect(first.getAttribute('aria-label')).toBe('Devolver el resto (70 €)');
    expect(first.getAttribute('title')).toBe('Devolver el resto (70 €)');
    expect(second.getAttribute('aria-label')).toBe('Devolver el resto (50 €)');
    expect(text(first), 'icon-only: no text').toBe('');
    expect(first.querySelector('ion-icon[slot="icon-only"]')).not.toBeNull();
  });

  it('a click emits `action` with the action id and THAT row', async () => {
    const t = mountTable({ rows: ROWS, columns: [{ key: 'number', label: 'Nº' }], actions: [refund] });
    await settle();
    await click(buttons(actionCells(t)[1])[0]);
    expect(t.emitted('action')).toEqual([[{ actionId: 'refund', row: ROWS[1] }]]);
  });
});

describe('row action tones (#162)', () => {
  const t = () =>
    mountTable({
      rows: [{ id: '1', name: 'A' }],
      columns: [{ key: 'name', label: 'Name' }],
      testid: 'dt',
      actions: [
        { id: 'edit', label: 'Edit', icon: 'create-outline' },
        { id: 'delete', label: 'Delete', icon: 'trash-outline', color: 'danger' },
        { id: 'save', label: 'Save', icon: 'checkmark-outline', disabled: () => true },
        { id: 'sync', label: 'Sync', icon: 'sync-outline', loading: () => true },
      ],
    });

  it('paints from the token, medium by default, never with a color= attribute', async () => {
    const table = t();
    await settle();
    expect(byTestId(table, 'dt-row-1-delete')[0].getAttribute('style')).toContain('--color: var(--ion-color-danger, #c5000f)');
    expect(byTestId(table, 'dt-row-1-edit')[0].getAttribute('style')).toContain('--color: var(--ion-color-medium, #636469)');
    expect(table.element.querySelectorAll('ion-button[color], ion-icon[color], ion-label[color]')).toHaveLength(0);
  });

  it('disabled greys out; loading shows a spinner and cannot be clicked again', async () => {
    const table = t();
    await settle();
    const save = byTestId(table, 'dt-row-1-save')[0] as HTMLElement & { disabled?: boolean };
    const sync = byTestId(table, 'dt-row-1-sync')[0] as HTMLElement & { disabled?: boolean };
    expect(save.disabled).toBe(true);
    expect(save.getAttribute('aria-disabled')).toBe('true');
    expect(sync.disabled).toBe(true);
    expect(sync.querySelector('ion-spinner[slot="icon-only"]')).not.toBeNull();
    expect(sync.querySelector('ion-icon')).toBeNull();
  });
});

describe('a row action hidden for a row (hub#2014) keeps its column (#240)', () => {
  const ROWS: Row[] = [{ id: 'issued', status: 'issued' }, { id: 'paid', status: 'paid' }, { id: 'voided', status: 'voided' }];
  const ACTIONS = [
    { id: 'view', label: 'View', icon: 'eye-outline' },
    { id: 'mark-paid', label: 'Mark paid', icon: 'checkmark-outline', hidden: (r: Row) => r.status !== 'issued' },
    { id: 'refund', label: 'Refund', hidden: (r: Row) => r.status === 'voided' },
  ];
  const props = { rows: ROWS, columns: [{ key: 'status', label: 'Status' }], testid: 'inv', actions: ACTIONS };
  const layout = (cell: HTMLElement) =>
    [...(cell.querySelector('.data-table__actions')?.children ?? [])].map((el) => {
      const tid = el.getAttribute('data-testid');
      return tid ? tid.replace(/^inv-row-[^-]+-/, '') : `gap:${el.getAttribute('data-slot-for') ?? '?'}`;
    });

  it('every row keeps one position per action, with an invisible stand-in where it is hidden', async () => {
    const t = mountTable(props);
    await settle();
    expect(actionCells(t).map(layout)).toEqual([
      ['view', 'mark-paid', 'refund'],
      ['view', 'gap:mark-paid', 'refund'],
      ['view', 'gap:mark-paid', 'gap:refund'],
    ]);
  });

  it('a stand-in is the same button (icon or text), out of the accessibility tree, the tab order and the click path', async () => {
    const t = mountTable(props);
    await settle();
    const gaps = [...t.element.querySelectorAll('[data-slot-for]')] as HTMLElement[];
    expect(gaps).toHaveLength(3);
    const [iconGap, , textGap] = gaps;
    expect(iconGap.classList.contains('data-table__action-gap')).toBe(true);
    expect((iconGap as HTMLElement & { fill?: string }).fill).toBe('clear');
    expect((iconGap as HTMLElement & { size?: string }).size).toBe('small');
    expect(iconGap.querySelector('ion-icon[slot="icon-only"]')).not.toBeNull();
    expect(text(textGap)).toBe('Refund');
    for (const gap of gaps) {
      expect(gap.getAttribute('aria-hidden')).toBe('true');
      expect(gap.hasAttribute('inert')).toBe(true);
      expect(gap.hasAttribute('aria-label')).toBe(false);
      await click(gap);
    }
    expect(t.emitted('action')).toBeUndefined();
  });

  it('a row-dependent label is borrowed from a row that shows the action, and follows new rows', async () => {
    const t = mountTable({
      ...props,
      actions: [ACTIONS[0], { id: 'refund', label: (r: Row) => `Refund ${(r.refund as { amount: string }).amount}`, hidden: (r: Row) => !r.refund }],
      rows: [{ id: 'issued', refund: { amount: '10 €' } }, { id: 'voided' }],
    });
    await settle();
    expect(text(actionCells(t)[1].querySelector('[data-slot-for="refund"]'))).toBe('Refund 10 €');
    await t.setProps({ rows: [{ id: 'issued', refund: { amount: '1.250,00 €' } }, { id: 'voided' }] });
    await settle();
    expect(text(actionCells(t)[1].querySelector('[data-slot-for="refund"]'))).toBe('Refund 1.250,00 €');
  });

  it('an action hidden on EVERY row gets no column; it comes back with a row that shows it', async () => {
    const t = mountTable({ ...props, rows: [ROWS[1], ROWS[2]] });
    await settle();
    expect(actionCells(t).map(layout)).toEqual([['view', 'refund'], ['view', 'gap:refund']]);
    await t.setProps({ rows: ROWS });
    await settle();
    expect(actionCells(t).map(layout)[1]).toEqual(['view', 'gap:mark-paid', 'refund']);
  });

  it('cards: the hidden action is simply not there (no column to line up with)', async () => {
    const t = mountTable({ ...props, views: true, defaultView: 'cards' });
    await settle();
    expect(t.element.querySelectorAll('[data-slot-for]')).toHaveLength(0);
    expect(cards(t).map((c) => buttons(c).map((b) => b.getAttribute('data-testid')))).toEqual([
      ['inv-row-issued-view', 'inv-row-issued-mark-paid', 'inv-row-issued-refund'],
      ['inv-row-paid-view', 'inv-row-paid-refund'],
      ['inv-row-voided-view'],
    ]);
  });

  it('hidden is not disabled: no greyed-out button is left behind', async () => {
    const t = mountTable(props);
    await settle();
    expect([...t.element.querySelectorAll('ion-button')].filter((b) => (b as HTMLElement & { disabled?: boolean }).disabled)).toHaveLength(0);
  });
});

describe('the actions track is pinned to the measured width of the widest row (#121)', () => {
  const BUTTON_PX = 44;
  function stubActionsWidth(width: (box: Element) => number) {
    vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockImplementation(function (this: Element) {
      return this.classList.contains('data-table__actions') ? width(this) : 0;
    });
  }
  const template = (t: ReturnType<typeof mountTable>) =>
    (t.element.querySelector('.data-table__row--head') as HTMLElement).style.gridTemplateColumns;
  const ACTIONS = [
    { id: 'open', label: 'Open', icon: 'open-outline' },
    { id: 'update', label: 'Update', icon: 'cloud-download-outline', hidden: (r: Row) => !r.update },
  ];
  const ROWS = [{ id: 'a', name: 'Modifiers', update: null }, { id: 'b', name: 'Sales', update: '2.0.0' }];

  it('unmeasured, the track reserves `max-content`; measured, it is the buttons’ width in px', async () => {
    const unmeasured = mountTable({ rows: ROWS, columns: [{ key: 'name', label: 'Name' }], actions: ACTIONS });
    await settle();
    expect(template(unmeasured).split(' ').at(-1)).toBe('max-content');
    stubActionsWidth((box) => box.querySelectorAll('ion-button:not(.data-table__action-gap)').length * BUTTON_PX);
    const t = mountTable({ rows: ROWS, columns: [{ key: 'name', label: 'Name' }], actions: ACTIONS });
    await settle();
    expect(template(t).split(' ').at(-1), 'the second row carries two buttons').toBe(`${2 * BUTTON_PX}px`);
    for (const row of dataRows(t)) expect(row.style.gridTemplateColumns).toBe(template(t));
  });
});

describe('the «Actions» header is never painted truncated (#211)', () => {
  const LABEL_PX = 63;
  async function lay(t: ReturnType<typeof mountTable>, cellPx: number, labelPx = LABEL_PX) {
    const cell = t.element.querySelector('.data-table__row--head .data-table__cell--actions') as HTMLElement;
    Object.defineProperty(cell, 'clientWidth', { configurable: true, get: () => cellPx });
    // The pinned cell keeps 1rem of right padding (it is not room for the label).
    const real = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element, pseudo?: string | null) =>
      el === cell ? ({ paddingLeft: '0px', paddingRight: '16px' } as CSSStyleDeclaration) : real(el, pseudo),
    );
    const label = cell.querySelector('span') as HTMLElement;
    Object.defineProperty(label, 'scrollWidth', { configurable: true, get: () => labelPx });
    window.dispatchEvent(new Event('resize'));
    await t.setProps({ rows: [{ id: '1', name: 'Ventas' }] });
    await settle();
  }
  const props = { rowKey: 'id', rows: [{ id: '1', name: 'Ventas' }], columns: [{ key: 'name', label: 'Nombre' }], actions: [{ id: 'install', label: 'Instalar', icon: 'download-outline' }] };
  const header = (t: ReturnType<typeof mountTable>) => t.element.querySelector('.data-table__row--head .data-table__cell--actions') as HTMLElement;

  it('too narrow: named for assistive tech, not painted; wide enough again: painted', async () => {
    const t = mountTable(props, { locale: 'es' });
    await settle();
    await lay(t, 60);
    expect(text(header(t).querySelector('.data-table__sr-only'))).toBe('Acciones');
    expect(text(header(t))).toBe('Acciones');
    await lay(t, LABEL_PX + 16);
    expect(header(t).querySelector('.data-table__sr-only')).toBeNull();
    await lay(t, LABEL_PX + 15);
    expect(header(t).querySelector('.data-table__sr-only')).not.toBeNull();
  });

  it('before anything is laid out (0px) the label keeps being shown', async () => {
    const t = mountTable(props, { locale: 'es' });
    await settle();
    await lay(t, 0, 0);
    expect(header(t).querySelector('.data-table__sr-only')).toBeNull();
  });
});

describe('on a narrow tablet the row actions fold into «…» (#122, #213)', () => {
  const ROWS = [{ id: '1', name: 'Familia Pérez' }, { id: '2', name: 'Marta Ruiz' }];
  const ACTIONS = [
    { id: 'confirm', label: 'Confirmar', icon: 'checkmark-outline' },
    { id: 'seat', label: 'Sentar', icon: 'restaurant-outline' },
    { id: 'cancel', label: 'Cancelar', icon: 'close-outline', color: 'danger' },
  ];
  const props = { rows: ROWS, columns: [{ key: 'name', label: 'Cliente' }], actions: ACTIONS, testid: 'bk' };
  const menuItems = (t: ReturnType<typeof mountTable>) => [...t.element.querySelectorAll('.data-table__row-menu ion-item')] as HTMLElement[];
  /** Stencil patches `textContent` of its scoped `ion-label` (slot relocation): read its markup. */
  const itemLabel = (item: HTMLElement) => item.querySelector('ion-label')?.innerHTML.trim();

  it('folded, each row shows ONE «More actions» button and the header keeps its name only for AT', async () => {
    const t = mountTable(props, { locale: 'es' });
    await settle();
    await fold(t);
    for (const cell of actionCells(t)) {
      expect(buttons(cell)).toHaveLength(1);
      expect(buttons(cell)[0].getAttribute('aria-label')).toBe('Más acciones');
      expect(buttons(cell)[0].getAttribute('aria-haspopup')).toBe('menu');
      expect(buttons(cell)[0].getAttribute('style')).toContain('--color: var(--ion-color-medium, #636469)');
    }
    expect(t.html()).not.toContain('More actions');
    expect(text(t.element.querySelector('.data-table__row--head .data-table__sr-only'))).toBe('Acciones');
  });

  it('the menu offers the actions of THAT row, painted with their tone, and emits for that row', async () => {
    const t = mountTable(props);
    await settle();
    await fold(t);
    await click(byTestId(t, 'bk-row-2-menu')[0]);
    expect(menuItems(t).map(itemLabel)).toEqual(['Confirmar', 'Sentar', 'Cancelar']);
    const cancel = menuItems(t)[2];
    expect(cancel.querySelector('ion-label')?.getAttribute('style')).toContain('color: var(--ion-color-danger, #c5000f)');
    expect(menuItems(t)[0].querySelector('ion-label')?.hasAttribute('style')).toBe(false);
    await click(menuItems(t)[1]);
    expect(t.emitted('action')).toEqual([[{ actionId: 'seat', row: ROWS[1] }]]);
    expect(menuItems(t), 'picking closes the menu').toHaveLength(0);
  });

  it('an action disabled for the row stays disabled in the menu, and does not emit', async () => {
    const t = mountTable({ ...props, actions: [{ ...ACTIONS[0], disabled: (r: Row) => r.id === '1' }, ACTIONS[1]] });
    await settle();
    await fold(t);
    await click(byTestId(t, 'bk-row-1-menu')[0]);
    const first = menuItems(t)[0] as HTMLElement & { disabled?: boolean };
    expect(first.disabled).toBe(true);
    expect(first.getAttribute('aria-disabled')).toBe('true');
    await click(first);
    expect(t.emitted('action')).toBeUndefined();
  });

  it('the hook lives on the menu item while folded, on the button when not — never twice', async () => {
    const t = mountTable(props);
    await settle();
    await fold(t);
    await click(byTestId(t, 'bk-row-1-menu')[0]);
    expect(byTestId(t, 'bk-row-1-seat').map((el) => el.tagName)).toEqual(['ION-ITEM']);
    await layOut(t, 1200, 1200);
    expect(byTestId(t, 'bk-row-1-seat').map((el) => el.tagName)).toEqual(['ION-BUTTON']);
  });

  it('a single ICON action stays out as its own button; a single TEXT action still folds', async () => {
    const icon = mountTable({ ...props, actions: [ACTIONS[0]] });
    const textOnly = mountTable({ ...props, actions: [{ id: 'use', label: 'Use template' }] });
    await settle();
    await fold(icon);
    await fold(textOnly);
    expect(buttons(actionCells(icon)[0]).map((b) => b.getAttribute('data-testid'))).toEqual(['bk-row-1-confirm']);
    expect(buttons(actionCells(textOnly)[0]).map((b) => b.getAttribute('data-testid'))).toEqual(['bk-row-1-menu']);
  });

  it('decides per row; a row with nothing left to do gets no «…» at all', async () => {
    const t = mountTable({
      ...props,
      rows: [{ id: 'a', update: null }, { id: 'b', update: '2.0' }, { id: 'c', update: null, locked: true }],
      actions: [
        { id: 'update', label: 'Update', icon: 'cloud-download-outline', hidden: (r: Row) => !r.update },
        { id: 'uninstall', label: 'Uninstall', icon: 'trash-outline', hidden: (r: Row) => r.locked === true },
      ],
    });
    await settle();
    await fold(t);
    expect(actionCells(t).map((c) => buttons(c).map((b) => b.getAttribute('data-testid')))).toEqual([
      ['bk-row-a-uninstall'],
      ['bk-row-b-menu'],
      [],
    ]);
  });

  it('a wider hole brings the buttons back', async () => {
    const t = mountTable(props);
    await settle();
    await fold(t);
    await layOut(t, 1200, 1200);
    expect(buttons(actionCells(t)[0])).toHaveLength(3);
  });
});

describe('the `row-actions` slot', () => {
  it('adds the consumer’s own controls to the row, list and cards, without opening the record', async () => {
    const slots = { 'row-actions': `<template #row-actions="{ row }"><button class="own">Go {{ row.id }}</button></template>` };
    const list = mountTable({ rows: [{ id: '1', name: 'A' }], columns: [{ key: 'name', label: 'Name' }], rowClickable: true }, { slots });
    const cardsView = mountTable({ rows: [{ id: '1', name: 'A' }], columns: [{ key: 'name', label: 'Name' }], views: true, defaultView: 'cards' }, { slots });
    await settle();
    expect(text(list.element.querySelector('.data-table__row--head .data-table__cell--actions')), 'it opens the actions column').toBe('Actions');
    const own = list.element.querySelector('.data-table__cell--actions .data-table__actions .own') as HTMLElement;
    expect(text(own)).toBe('Go 1');
    await click(own);
    expect(list.emitted('rowClick')).toBeUndefined();
    expect(text(cardsView.element.querySelector('.data-table__card-actions .own'))).toBe('Go 1');
  });
});

describe('a row action with `showLabel` paints its icon AND its text (mockups/saas-panel §3b, §6.16)', () => {
  const ROWS = [{ id: '1', name: 'Bar Norte' }, { id: '2', name: 'Tienda Sol' }];
  const OPEN = { id: 'open', label: 'Open', icon: 'log-in-outline', showLabel: true };
  const DELETE = { id: 'delete', label: 'Delete', icon: 'trash-outline' };
  const props = { rows: ROWS, columns: [{ key: 'name', label: 'Name' }], actions: [OPEN, DELETE], testid: 'biz' };
  const menuItems = (t: ReturnType<typeof mountTable>) => [...t.element.querySelectorAll('.data-table__row-menu ion-item')] as HTMLElement[];

  it('list: the icon at the start and the label as text; an action without it stays icon-only', async () => {
    const t = mountTable(props);
    await settle();
    const open = byTestId(t, 'biz-row-1-open')[0];
    expect(open.querySelector('ion-icon[slot="start"]')).not.toBeNull();
    expect(open.querySelector('[slot="icon-only"]')).toBeNull();
    expect(text(open)).toBe('Open');
    expect(open.classList.contains('data-table__action--labelled')).toBe(true);
    const del = byTestId(t, 'biz-row-1-delete')[0];
    expect(del.querySelector('ion-icon[slot="icon-only"]')).not.toBeNull();
    expect(text(del)).toBe('');
    expect(del.classList.contains('data-table__action--labelled')).toBe(false);
  });

  it('cards: the same labelled button', async () => {
    const t = mountTable({ ...props, views: true, defaultView: 'cards' });
    await settle();
    const open = byTestId(t, 'biz-row-2-open')[0];
    expect(open.closest('.data-table__card-actions')).not.toBeNull();
    expect(open.querySelector('ion-icon[slot="start"]')).not.toBeNull();
    expect(text(open)).toBe('Open');
  });

  it('in progress: the spinner takes the icon’s place and the label stays', async () => {
    const t = mountTable({ ...props, actions: [{ ...OPEN, loading: (r: Row) => r.id === '1' }] });
    await settle();
    const open = byTestId(t, 'biz-row-1-open')[0] as HTMLElement & { disabled?: boolean };
    expect(open.querySelector('ion-spinner[slot="start"]')).not.toBeNull();
    expect(open.querySelector('ion-icon')).toBeNull();
    expect(text(open)).toBe('Open');
    expect(open.disabled).toBe(true);
  });

  it('a hidden labelled action keeps its place with a stand-in of the same icon and text (#240)', async () => {
    const t = mountTable({ ...props, actions: [{ ...OPEN, hidden: (r: Row) => r.id === '2' }, DELETE] });
    await settle();
    const gap = actionCells(t)[1].querySelector('[data-slot-for="open"]') as HTMLElement;
    expect(gap.querySelector('ion-icon[slot="start"]')).not.toBeNull();
    expect(text(gap)).toBe('Open');
    expect(gap.classList.contains('data-table__action--labelled')).toBe(true);
  });

  it('folded, a single labelled action goes into «⋮» like a text one (#213), where it reads with its icon and label', async () => {
    const t = mountTable({ ...props, actions: [OPEN] });
    await settle();
    await fold(t);
    expect(buttons(actionCells(t)[0]).map((b) => b.getAttribute('data-testid'))).toEqual(['biz-row-1-menu']);
    await click(byTestId(t, 'biz-row-1-menu')[0]);
    const [item] = menuItems(t);
    expect(item.querySelector('ion-icon[slot="start"]')).not.toBeNull();
    expect(item.querySelector('ion-label')?.innerHTML.trim()).toBe('Open');
  });
});
