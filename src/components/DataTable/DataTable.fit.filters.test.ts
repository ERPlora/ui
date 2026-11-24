// The open filters panel takes its place inside the table's box: the rows have less room and the box is as wide as
// before. Widths measured in Chrome (Invoices on a 1280px tablet with the side menu open): the box is 1008px and the
// list needs 804px even with everything given up.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { change, control } from './__tests__/filter-table';
import { byTestId, cards, clearLayout, click, dataRows, ionChange, mountTable, playBackLayout, resize, setBoxWidth, settle } from './__tests__/harness';

type Table = ReturnType<typeof mountTable>;

const BOX = 1008;
const LIST = 804;

beforeEach(() => {
  playBackLayout(40, (el, room) => (el.classList.contains('data-table__scroll') ? Math.max(LIST, room) : 0));
});

afterEach(clearLayout);

const COLUMNS = [
  { key: 'number', label: 'Number' },
  { key: 'customer', label: 'Customer' },
  {
    key: 'status',
    label: 'Status',
    filter: {
      type: 'select',
      options: [
        { value: 'issued', label: 'Issued' },
        { value: 'paid', label: 'Paid' },
        { value: 'void', label: 'Void' },
      ],
    },
  },
];
const ACTIONS = [
  { id: 'open', label: 'Open', icon: 'open-outline' },
  { id: 'print', label: 'Print', icon: 'print-outline' },
];
const ROWS = [
  { id: 'i1', number: 'F-1', customer: 'Bar La Plaza', status: 'issued' },
  { id: 'i2', number: 'F-2', customer: 'Panadería López', status: 'paid' },
];

async function mountInvoices(extra: Record<string, unknown> = {}): Promise<Table> {
  setBoxWidth(BOX);
  const t = mountTable({ rows: ROWS, columns: COLUMNS, actions: ACTIONS, views: ['table', 'cards'], filterable: true, testid: 'rules', ...extra });
  await settle();
  return t;
}

const press = (t: Table, hook: string) => click(byTestId(t, `rules-filters-${hook}`)[0]);
const pick = (t: Table, view: 'table' | 'cards') => ionChange(byTestId(t, 'rules-view')[0], { value: view });
/** What the list/cards switch marks, with what is painted: `[marked, rows, cards]`. */
const shown = (t: Table) => [
  (byTestId(t, 'rules-view')[0] as HTMLElement & { value?: string }).value,
  dataRows(t).length,
  cards(t).length,
];
const LISTED = ['table', 2, 0];
const IN_CARDS = ['cards', 0, 2];

describe('a list that became cards because the filters panel took its room', () => {
  it('is a list again once the panel closes with its X, and the switch marks the list', async () => {
    const t = await mountInvoices();
    expect(shown(t)).toEqual(LISTED);
    await press(t, 'toggle');
    expect(shown(t), 'the panel leaves 648 of the 804px it needs').toEqual(IN_CARDS);
    await press(t, 'close');
    expect(shown(t)).toEqual(LISTED);
    await press(t, 'toggle');
    expect(shown(t), 'not a one-shot').toEqual(IN_CARDS);
    await press(t, 'toggle');
    expect(shown(t)).toEqual(LISTED);
    expect(t.emitted('viewChange'), 'nobody picked a view').toBeUndefined();
  });

  it('is a list again with «Apply», with the rows it leaves and with none', async () => {
    const t = await mountInvoices();
    await press(t, 'toggle');
    await change(control(t, 'status'), 'paid');
    await press(t, 'apply');
    expect(shown(t)).toEqual(['table', 1, 0]);
    await press(t, 'toggle');
    expect(shown(t)).toEqual(['cards', 0, 1]);
    await change(control(t, 'status'), 'void');
    await press(t, 'apply');
    expect(shown(t), 'no invoice is void').toEqual(['table', 0, 0]);
    expect(t.emitted('viewChange')).toBeUndefined();
  });

  it('is a list again beside the open panel once both fit', async () => {
    const t = await mountInvoices();
    await press(t, 'toggle');
    await resize(LIST + 359);
    expect(shown(t)).toEqual(IN_CARDS);
    await resize(LIST + 360);
    expect(shown(t)).toEqual(LISTED);
    expect(byTestId(t, 'rules-filters-panel')).toHaveLength(1);
  });

  it('stays in cards while the box itself is too narrow for it', async () => {
    const t = await mountInvoices();
    await press(t, 'toggle');
    await resize(LIST - 1);
    await press(t, 'close');
    expect(shown(t)).toEqual(IN_CARDS);
    await resize(LIST);
    expect(shown(t)).toEqual(LISTED);
  });
});

describe('the filters panel never moves the view the person picked', () => {
  it('cards picked by hand stay cards once it closes', async () => {
    const t = await mountInvoices();
    await pick(t, 'cards');
    await press(t, 'toggle');
    await press(t, 'close');
    expect(shown(t)).toEqual(IN_CARDS);
  });

  it('the list picked by hand beside it stays a list, closed and open again', async () => {
    const t = await mountInvoices();
    await press(t, 'toggle');
    await pick(t, 'table');
    expect(shown(t)).toEqual(LISTED);
    await press(t, 'close');
    expect(shown(t)).toEqual(LISTED);
    await press(t, 'toggle');
    expect(shown(t)).toEqual(LISTED);
  });
});
