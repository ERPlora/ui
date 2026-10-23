// W-19 (mockups/saas-panel/README.md §3b, UX-AUDIT-3): what fits is decided by the table's OWN box
// (a `ResizeObserver` on it), never by the viewport. As the box narrows the list gives up, in this
// order: the `priority: 'low'` columns → the row actions beyond `maxInlineActions` (into «⋮») →
// every action that is not `pinned` → the list itself, for cards. happy-dom lays nothing out: a
// fake layout engine sizes the grid from what is painted, and the ResizeObserver mock plays the
// box's resizes back.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { byTestId, cards, click, dataRows, ionChange, mockResizeObserver, mountTable, settle, text, viewport } from './__tests__/harness';

type Row = Record<string, unknown>;
type Table = ReturnType<typeof mountTable>;

// ── Fake layout engine ────────────────────────────────────────────────────────────────────────
const PAD = 32; // side padding of a row
const COLUMN = 100; // a data column at its floor
const BUTTON = 40; // a button of the actions cell (a stand-in and «⋮» too)
const CHECKBOX = 44; // the selection column

/** Width of the table's box (the host and its scroller). */
let box = 900;

/** What the grid needs: its columns at their floor plus the widest actions cell. */
function gridWidth(scroll: Element): number {
  const head = scroll.querySelector('.data-table__row--head');
  if (!head) return 0;
  const columns = head.querySelectorAll('.data-table__cell--header:not(.data-table__cell--actions)').length;
  const select = head.querySelector('.data-table__select-cell') ? CHECKBOX : 0;
  let buttons = 0;
  for (const cell of scroll.querySelectorAll('.data-table__row--data .data-table__actions')) {
    buttons = Math.max(buttons, [...cell.children].filter((el) => el.tagName === 'ION-BUTTON').length);
  }
  return PAD + select + columns * COLUMN + buttons * BUTTON;
}

function playBackLayout(): void {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('data-table') || this.classList.contains('data-table__scroll') ? box : 0;
  });
  vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockImplementation(function (this: Element) {
    return this.classList.contains('data-table__scroll') ? Math.max(gridWidth(this), box) : 0;
  });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    () => ({ width: BUTTON, height: BUTTON, top: 0, left: 0, right: BUTTON, bottom: BUTTON, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect,
  );
}

let observers: { fire: () => void };

/** The table's box takes `width` px (a side menu opening, a window resize…). */
async function resize(width: number): Promise<void> {
  box = width;
  observers.fire();
  await settle();
}

beforeEach(() => {
  viewport(false);
  box = 900;
  observers = mockResizeObserver();
  playBackLayout();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

// ── The businesses of the SaaS panel ──────────────────────────────────────────────────────────
const COLUMNS = [
  { key: 'name', label: 'Business', priority: 'high' },
  { key: 'status', label: 'Status' },
  { key: 'plan', label: 'Plan' },
  { key: 'address', label: 'Web address', priority: 'low' },
  { key: 'role', label: 'Role', priority: 'low' },
  { key: 'lastUsed', label: 'Last used' },
];
const ACTIONS = [
  { id: 'open', label: 'Open', icon: 'open-outline', pinned: true },
  { id: 'manage', label: 'Manage', icon: 'settings-outline' },
  { id: 'pay', label: 'Pay', icon: 'card-outline' },
  { id: 'transfer', label: 'Transfer ownership', icon: 'swap-horizontal-outline', menuOnly: true },
];
const ROWS: Row[] = [
  { id: 'b1', name: 'Bar La Plaza', status: 'Active', plan: 'Pro', address: 'bar-la-plaza.erplora.com', role: 'Owner', lastUsed: 'Today' },
  { id: 'b2', name: 'Panadería López', status: 'Past due', plan: 'Free', address: 'panaderia.erplora.com', role: 'Admin', lastUsed: '12 days ago' },
];
// Widths the fake engine gives this table: all out 792 · without the low columns 592 · two actions
// out and «⋮» 552 · only the pinned one and «⋮» 512.
const props = (extra: Record<string, unknown> = {}) => ({
  rows: ROWS,
  columns: COLUMNS,
  actions: ACTIONS,
  views: ['table', 'cards'],
  testid: 'biz',
  ...extra,
});

const isCards = (t: Table) => !!t.element.querySelector('.data-table__cards');
const headers = (t: Table) =>
  [...t.element.querySelectorAll('.data-table__row--head .data-table__cell--header:not(.data-table__cell--actions)')].map((h) => text(h));
/** The buttons of a row's actions cell by their hook suffix; a stand-in as `gap:<slot>`. */
const rowButtons = (t: Table, index = 0) =>
  [...(dataRows(t)[index]?.querySelectorAll('.data-table__actions > ion-button') ?? [])].map((b) => {
    const hook = b.getAttribute('data-testid');
    return hook ? hook.replace(/^biz-row-[^-]+-/, '') : `gap:${b.getAttribute('data-slot-for') ?? '?'}`;
  });
const scroller = (t: Table) => t.element.querySelector('.data-table__scroll') as HTMLElement;
const menuItems = (t: Table) => [...t.element.querySelectorAll('.data-table__row-menu ion-item')] as HTMLElement[];
/** Stencil patches `textContent` of its scoped `ion-label`: read its markup. */
const menuLabels = (t: Table) => menuItems(t).map((item) => item.querySelector('ion-label')?.innerHTML.trim());
const cardFieldLabels = (t: Table, index = 0) =>
  [...cards(t)[index].querySelectorAll('.data-table__field-label')].map((l) => text(l));
const segment = (t: Table) => t.element.querySelector('.data-table__view-segment') as HTMLElement;

async function mountAt(width: number, extra: Record<string, unknown> = {}): Promise<Table> {
  box = width;
  const t = mountTable(props(extra));
  await settle();
  return t;
}

describe('the list fits its BOX: low columns → extra actions → all but pinned → cards (W-19)', () => {
  it('gives up one thing at a time as the box narrows, and takes it all back when it widens', async () => {
    const t = await mountAt(900);
    expect(headers(t), '900: everything fits').toEqual(['Business', 'Status', 'Plan', 'Web address', 'Role', 'Last used']);
    expect(rowButtons(t)).toEqual(['open', 'manage', 'pay', 'menu']);

    await resize(700);
    expect(headers(t), '700: the low columns go first').toEqual(['Business', 'Status', 'Plan', 'Last used']);
    expect(rowButtons(t), 'the actions are untouched').toEqual(['open', 'manage', 'pay', 'menu']);

    await resize(560);
    expect(headers(t)).toEqual(['Business', 'Status', 'Plan', 'Last used']);
    expect(rowButtons(t), '560: beyond maxInlineActions (2) into «⋮»').toEqual(['open', 'manage', 'menu']);

    await resize(520);
    expect(rowButtons(t), '520: only the pinned one stays out').toEqual(['open', 'menu']);
    expect(isCards(t)).toBe(false);

    await resize(480);
    expect(isCards(t), '480: not even folded: cards').toBe(true);
    expect((segment(t) as HTMLElement & { value?: string }).value, 'the switch says so').toBe('cards');

    await resize(900);
    expect(isCards(t), 'wide again: the list').toBe(false);
    expect(headers(t)).toEqual(['Business', 'Status', 'Plan', 'Web address', 'Role', 'Last used']);
    expect(rowButtons(t)).toEqual(['open', 'manage', 'pay', 'menu']);
    expect(scroller(t).classList.contains('data-table__scroll--overflow')).toBe(false);
  });

  it('a hidden low column is still a field of the cards (the cards have room for it)', async () => {
    const t = await mountAt(480);
    expect(isCards(t)).toBe(true);
    expect(cardFieldLabels(t)).toEqual(['Business', 'Status', 'Plan', 'Web address', 'Role', 'Last used']);
    expect(text(cards(t)[0])).toContain('bar-la-plaza.erplora.com');
  });

  it('it is the box, not the window: a wide window with a narrow box still gives up', async () => {
    const t = await mountAt(560);
    expect(rowButtons(t)).toEqual(['open', 'manage', 'menu']);
    expect(headers(t)).not.toContain('Role');
  });

  it('`cardBreakpoint` stays the floor: at or below it (a phone) the table is cards at any box', async () => {
    viewport(true);
    const t = await mountAt(900);
    expect(isCards(t)).toBe(true);
  });

  it('`maxInlineActions` says how many buttons stay out at the first fold (2 by default)', async () => {
    const columns = COLUMNS.filter((c) => c.priority !== 'low');
    // 4 columns: all out 592 · two out 552 · one out 512.
    const byDefault = await mountAt(560, { columns });
    const one = await mountAt(560, { columns, maxInlineActions: 1 });
    expect(rowButtons(byDefault)).toEqual(['open', 'manage', 'menu']);
    expect(rowButtons(one), 'the pinned one takes the only place').toEqual(['open', 'menu']);
  });

  it('when even the cards cannot be had, the list scrolls INSIDE its box, never the page', async () => {
    const t = await mountAt(480, { views: false });
    expect(isCards(t)).toBe(false);
    expect(rowButtons(t), 'everything given up first').toEqual(['open', 'menu']);
    expect(headers(t)).toEqual(['Business', 'Status', 'Plan', 'Last used']);
    expect(scroller(t).classList.contains('data-table__scroll--overflow')).toBe(true);
  });
});

// hub#94 (Time clock › Records at 834px): folded into «⋮», the list still did not fit, yet it stayed a
// list scrolled sideways, with the pinned «⋮» over its last column, instead of handing over to the
// cards. The «Actions» header no longer fitting its narrower track was written while the actions were
// folded, a state the render does not read: no render followed, and the ladder waited for one forever.
describe('a measurement that paints nothing never stalls the ladder (hub#94)', () => {
  const LABEL = 60; // the «Actions» header label, wider than «⋮» alone
  const COLUMNS_4 = COLUMNS.filter((c) => c.priority !== 'low');
  const LABELLED = [
    { id: 'correct', label: 'Correct', icon: 'create-outline', showLabel: true },
    { id: 'history', label: 'History', icon: 'time-outline', showLabel: true },
  ];

  /** The header's actions cell is as wide as the track its row paints (the last of its template). */
  function playBackActionsHeader(): void {
    const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')!.get!;
    const scrollWidth = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollWidth')!.get!;
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
      if (this.matches('.data-table__row--head > .data-table__cell--actions')) {
        const track = (this.parentElement as HTMLElement).style.gridTemplateColumns.split(' ').pop() ?? '';
        return track.endsWith('px') ? parseFloat(track) : 0;
      }
      return clientWidth.call(this);
    });
    vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockImplementation(function (this: Element) {
      return this.matches('.data-table__row--head > .data-table__cell--actions > span') ? LABEL : scrollWidth.call(this);
    });
  }

  beforeEach(playBackActionsHeader);

  it('folded and still too wide, the list hands over to the cards; nothing stays under «⋮»', async () => {
    // 4 columns: both actions out 512 · «⋮» alone 472. The box is 460: not even folded.
    const t = await mountAt(460, { columns: COLUMNS_4, actions: LABELLED });
    expect(isCards(t)).toBe(true);
    expect((segment(t) as HTMLElement & { value?: string }).value).toBe('cards');
    expect(t.element.querySelectorAll('.data-table__scroll')).toHaveLength(0);
  });

  it('folded and fitting, it stays the list, with «⋮» in its own track and nothing hidden sideways', async () => {
    const t = await mountAt(480, { columns: COLUMNS_4, actions: LABELLED });
    expect(isCards(t)).toBe(false);
    expect(rowButtons(t)).toEqual(['menu']);
    expect((t.element.querySelector('.data-table__row--head') as HTMLElement).style.gridTemplateColumns).toBe(
      'minmax(5.5rem,1fr) minmax(5.5rem,1fr) minmax(5.5rem,1fr) minmax(5.5rem,1fr) 40px',
    );
    expect(scroller(t).classList.contains('data-table__scroll--overflow')).toBe(false);
  });

  it('wide again, the list comes back with both buttons and its «Actions» header painted', async () => {
    const t = await mountAt(460, { columns: COLUMNS_4, actions: LABELLED });
    expect(isCards(t)).toBe(true);
    await resize(600);
    expect(isCards(t)).toBe(false);
    expect(rowButtons(t)).toEqual(['correct', 'history']);
    const header = t.element.querySelector('.data-table__row--head > .data-table__cell--actions > span') as HTMLElement;
    expect(header.className).toBe('');
  });
  it('the rescue is not a one-shot: narrow → cards, wide → list, narrow again → cards again', async () => {
    // A second stall (the label written again while folded) must be measured past as well: a settle
    // that never re-arms would rescue the first and leave every later one under «⋮».
    const t = await mountAt(460, { columns: COLUMNS_4, actions: LABELLED });
    expect(isCards(t), '460: cards').toBe(true);
    await resize(600);
    expect(isCards(t), '600: the list').toBe(false);
    await resize(460);
    expect(isCards(t), '460 again: cards again').toBe(true);
    expect(t.element.querySelectorAll('.data-table__scroll')).toHaveLength(0);
  });

});

describe('a refresh of the rows keeps what the box decided (W-19)', () => {
  it('the same rows again (a live update) do not paint the hidden columns back, not even for a moment', async () => {
    const address = vi.fn((value: unknown) => String(value));
    const columns = COLUMNS.map((c) => (c.key === 'address' ? { ...c, format: address } : c));
    const t = await mountAt(560, { columns });
    expect(rowButtons(t)).toEqual(['open', 'manage', 'menu']);
    address.mockClear();
    await t.setProps({ rows: ROWS.map((r) => ({ ...r })) });
    await settle();
    expect(address).not.toHaveBeenCalled();
    expect(headers(t)).not.toContain('Web address');
    expect(rowButtons(t)).toEqual(['open', 'manage', 'menu']);
  });
});

describe('the person’s own view is never overridden by the fit (W-19)', () => {
  it('the list picked by hand in a box too narrow stays a list (scrolling inside), at any width', async () => {
    const t = await mountAt(480);
    expect(isCards(t)).toBe(true);
    await ionChange(segment(t), { value: 'table' });
    expect(t.emitted('viewChange')).toEqual([['table']]);
    expect(isCards(t)).toBe(false);
    expect(rowButtons(t)).toEqual(['open', 'menu']);
    expect(scroller(t).classList.contains('data-table__scroll--overflow')).toBe(true);
    await resize(470);
    expect(isCards(t)).toBe(false);
  });

  it('the cards picked by hand in a wide box stay cards', async () => {
    const t = await mountAt(900);
    await ionChange(segment(t), { value: 'cards' });
    await resize(1000);
    expect(isCards(t)).toBe(true);
  });
});

describe('`pinned` and `menuOnly` row actions (§3b: the main action stays, the delicate ones live in «⋮»)', () => {
  it('a `menuOnly` action never gets a button: «⋮» offers it, hooked, and emits for that row', async () => {
    const t = await mountAt(900);
    expect(byTestId(t, 'biz-row-b2-transfer')).toHaveLength(0);
    await click(byTestId(t, 'biz-row-b2-menu')[0]);
    expect(menuLabels(t)).toEqual(['Transfer ownership']);
    expect(byTestId(t, 'biz-row-b2-transfer').map((el) => el.tagName)).toEqual(['ION-ITEM']);
    await click(menuItems(t)[0]);
    expect(t.emitted('action')).toEqual([[{ actionId: 'transfer', row: ROWS[1] }]]);
  });

  it('folded, «⋮» holds what left the row, in order; the pinned one is still a button', async () => {
    const t = await mountAt(520);
    expect(rowButtons(t)).toEqual(['open', 'menu']);
    await click(byTestId(t, 'biz-row-b1-menu')[0]);
    expect(menuLabels(t)).toEqual(['Manage', 'Pay', 'Transfer ownership']);
    await click(byTestId(t, 'biz-row-b1-open')[0]);
    expect(t.emitted('action')?.[0]).toEqual([{ actionId: 'open', row: ROWS[0] }]);
  });

  it('a row without anything for «⋮» keeps an invisible stand-in, so the buttons stay in their column', async () => {
    const actions = ACTIONS.map((a) => (a.id === 'transfer' ? { ...a, hidden: (r: Row) => r.role !== 'Owner' } : a));
    const t = await mountAt(900, { actions });
    expect(rowButtons(t, 0)).toEqual(['open', 'manage', 'pay', 'menu']);
    expect(rowButtons(t, 1)).toEqual(['open', 'manage', 'pay', 'gap:menu']);
    const gap = dataRows(t)[1].querySelector('[data-slot-for="menu"]') as HTMLElement;
    expect(gap.getAttribute('aria-hidden')).toBe('true');
    expect(gap.hasAttribute('inert')).toBe(true);
  });

  it('cards: every action is a button except the `menuOnly` ones, which stay in the card’s «⋮»', async () => {
    const t = await mountAt(900, { defaultView: 'cards' });
    const buttons = [...cards(t)[0].querySelectorAll('.data-table__card-actions ion-button')].map((b) => b.getAttribute('data-testid'));
    expect(buttons).toEqual(['biz-row-b1-open', 'biz-row-b1-manage', 'biz-row-b1-pay', 'biz-row-b1-menu']);
    await click(byTestId(t, 'biz-row-b1-menu')[0]);
    expect(menuLabels(t)).toEqual(['Transfer ownership']);
    await click(menuItems(t)[0]);
    expect(t.emitted('action')).toEqual([[{ actionId: 'transfer', row: ROWS[0] }]]);
  });
});

describe('the column chooser and the low columns the box hid', () => {
  const chooser = (t: Table) => t.element.querySelector('.data-table__columns-select') as HTMLElement & { value?: string[] };

  it('a column the box hid shows unpicked, can be picked back, and the box makes room without it', async () => {
    const t = await mountAt(700);
    expect(chooser(t).value).toEqual(['name', 'status', 'plan', 'lastUsed']);
    expect([...chooser(t).querySelectorAll('ion-select-option')].map((o) => text(o))).toEqual(COLUMNS.map((c) => c.label));
    await ionChange(chooser(t), { value: ['name', 'status', 'plan', 'lastUsed', 'address'] });
    // Picked by hand it stays; the other low column still goes: 5 columns fit in 700.
    expect(headers(t)).toEqual(['Business', 'Status', 'Plan', 'Web address', 'Last used']);
    expect(t.emitted('columnsChange')).toEqual([[['name', 'status', 'plan', 'lastUsed', 'address']]]);
    await resize(900);
    expect(headers(t), 'wide again: the hidden one comes back by itself').toEqual(COLUMNS.map((c) => c.label));
  });

  it('a column the person unpicks stays out, in the list AND in the cards', async () => {
    const t = await mountAt(900);
    await ionChange(chooser(t), { value: ['name', 'status', 'plan', 'role', 'lastUsed'] });
    expect(headers(t)).toEqual(['Business', 'Status', 'Plan', 'Role', 'Last used']);
    await resize(480);
    expect(isCards(t)).toBe(true);
    expect(cardFieldLabels(t)).toEqual(['Business', 'Status', 'Plan', 'Role', 'Last used']);
  });
});

describe('no regression: server mode and selection while folded', () => {
  it('sorts, selects and runs a folded action exactly as before', async () => {
    const columns = COLUMNS.map((c) => (c.key === 'name' ? { ...c, sortable: true } : c));
    // With the checkbox column: 4 columns, the pinned one and «⋮» = 556.
    const t = await mountAt(560, { columns, serverSide: true, total: 30, pageSize: 2, selectable: true });
    expect(rowButtons(t)).toEqual(['open', 'menu']);
    await click(t.element.querySelector('.data-table__row--head [role="columnheader"]'));
    expect(t.emitted('sortChange')).toEqual([[{ sort: 'name', dir: 'asc' }]]);
    await ionChange(dataRows(t)[1].querySelector('ion-checkbox') as HTMLElement);
    expect(t.emitted('update:selected')).toEqual([[['b2']]]);
    await click(byTestId(t, 'biz-row-b2-menu')[0]);
    await click(menuItems(t).find((item) => item.getAttribute('data-testid') === 'biz-row-b2-pay'));
    expect(t.emitted('action')).toEqual([[{ actionId: 'pay', row: ROWS[1] }]]);
    expect(t.emitted('pageChange')).toBeUndefined();
  });
});

// FIX-UI-DATATABLE-EMAIL-COLUMN-834 (Cart & Checkout › Orders at 834px): every column without its own width took the
// same share of the row, so a long email was cut («ana@example.c…») beside a half-empty Payment. Each rung of the
// ladder is now first tried with every column holding its content whole (and sharing what is left, as before); only
// when that does not fit is the widest text cut, down to the floor, before the ladder gives anything else up. This
// fake engine sizes the grid from the TEMPLATE the head paints (each track's minimum) and a text from its length.
describe('a column holds its content whole while the row has room (FIX-UI-DATATABLE-EMAIL-COLUMN-834)', () => {
  const CHAR = 8; // px per character of a text
  const FLOOR = 88; // 5.5rem
  const EMAIL = 'ana.garcia.lopez@example.com'; // 28 characters: 224px of text, a 225px column
  const COLUMNS_834 = [
    { key: 'email', label: 'Email' },
    { key: 'status', label: 'Status' },
    { key: 'total', label: 'Total' },
    { key: 'note', label: 'Note', priority: 'low', width: '12rem' },
  ];
  const ROWS_834 = [
    { id: 'o1', email: EMAIL, status: 'Paid', total: '€25.00', note: 'Gift' },
    { id: 'o2', email: 'bea@example.com', status: 'Failed', total: '€8.00', note: '' },
  ];
  const ACTIONS_834 = [
    { id: 'pay', label: 'Pay', icon: 'card-outline' },
    { id: 'fail', label: 'Fail', icon: 'close-outline' },
  ];
  // Widths of this table: whole 705 · cut 568 · without Note whole 513, cut 376 · folded whole 473, cut 336.
  const props834 = { columns: COLUMNS_834, rows: ROWS_834, actions: ACTIONS_834, views: false };
  const template = (t: Table) => (t.element.querySelector('.data-table__row--head') as HTMLElement).style.gridTemplateColumns;

  /** The minimum a track of the head's template takes, in px. */
  function trackMin(track: string, scroll: Element): number {
    const own = track.match(/^minmax\((\d+)px,1fr\)$/);
    if (own) return Number(own[1]);
    if (track.startsWith('minmax(5.5rem,')) return FLOOR;
    const px = track.match(/^(\d+)px$/);
    if (px) return Number(px[1]);
    const rem = track.match(/^([\d.]+)rem$/);
    if (rem) return Number(rem[1]) * 16;
    if (track === 'max-content') {
      let buttons = 0;
      for (const cell of scroll.querySelectorAll('.data-table__row--data .data-table__actions')) {
        buttons = Math.max(buttons, [...cell.children].filter((el) => el.tagName === 'ION-BUTTON').length);
      }
      return buttons * BUTTON;
    }
    throw new Error(`the fake engine does not size «${track}»`);
  }

  beforeEach(() => {
    const scrollWidth = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollWidth')!.get!;
    vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockImplementation(function (this: Element) {
      if (this.classList.contains('data-table__scroll')) {
        const head = this.querySelector<HTMLElement>('.data-table__row--head');
        const tracks = (head?.style.gridTemplateColumns ?? '').split(' ').filter(Boolean);
        return Math.max(PAD + tracks.reduce((sum, track) => sum + trackMin(track, this), 0), box);
      }
      // A text of a data cell or of a header: as wide as its characters, whatever its box.
      if (this.tagName === 'SPAN' && this.parentElement?.matches('.data-table__cell:not(.data-table__cell--actions)')) {
        return (this.textContent?.trim().length ?? 0) * CHAR;
      }
      return scrollWidth.call(this);
    });
  });

  it('with room, the long email keeps its 225px and the rest share what is left, as before', async () => {
    const t = await mountAt(720, props834);
    expect(template(t)).toBe('minmax(225px,1fr) minmax(5.5rem,1fr) minmax(5.5rem,1fr) 12rem 80px');
    expect(headers(t)).toEqual(['Email', 'Status', 'Total', 'Note']);
    expect(rowButtons(t)).toEqual(['pay', 'fail']);
    expect(scroller(t).classList.contains('data-table__scroll--overflow')).toBe(false);
  });

  it('out of room, the email gives its width up first; the ladder of before follows, each rung tried whole first', async () => {
    const t = await mountAt(720, props834);

    await resize(600);
    expect(template(t), '600: cut, down to the floor; nothing else given up').toBe(
      'minmax(5.5rem,225px) minmax(5.5rem,1fr) minmax(5.5rem,1fr) 12rem 80px',
    );
    expect(headers(t)).toContain('Note');
    expect(rowButtons(t)).toEqual(['pay', 'fail']);

    await resize(540);
    expect(headers(t), '540: not even cut: the low column goes').toEqual(['Email', 'Status', 'Total']);
    expect(template(t), 'and without it the email is whole again').toBe('minmax(225px,1fr) minmax(5.5rem,1fr) minmax(5.5rem,1fr) 80px');

    await resize(480);
    expect(template(t), '480: cut again before the actions fold').toBe('minmax(5.5rem,225px) minmax(5.5rem,1fr) minmax(5.5rem,1fr) 80px');
    expect(rowButtons(t)).toEqual(['pay', 'fail']);

    await resize(340);
    expect(rowButtons(t), '340: folded into «⋮», and cut').toEqual(['menu']);
    expect(template(t)).toBe('minmax(5.5rem,225px) minmax(5.5rem,1fr) minmax(5.5rem,1fr) 40px');
    expect(scroller(t).classList.contains('data-table__scroll--overflow')).toBe(false);

    await resize(720);
    expect(template(t), 'wide again: whole, everything back').toBe('minmax(225px,1fr) minmax(5.5rem,1fr) minmax(5.5rem,1fr) 12rem 80px');
    expect(headers(t)).toEqual(['Email', 'Status', 'Total', 'Note']);
    expect(rowButtons(t)).toEqual(['pay', 'fail']);
  });

  it('a column with its own width keeps it, and no column cuts a text its floor already holds', async () => {
    const t = await mountAt(720, { ...props834, rows: [ROWS_834[1]] });
    // «bea@example.com» is 120px: more than the floor, so it is held whole too; «Failed» and «€8.00» fit the floor.
    expect(template(t)).toBe('minmax(121px,1fr) minmax(5.5rem,1fr) minmax(5.5rem,1fr) 12rem 80px');
  });
});
