// DataTable card view: the card opens its record (#74), its head is one row in ios (#79), the title
// is not repeated in the body (#205), the `card` slot replaces the body. Cases ported from Lit.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cards, click, ionChange, mountTable, settle, text, viewport } from './__tests__/harness';

type Row = Record<string, unknown>;

beforeEach(() => {
  viewport(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

const fields = (t: ReturnType<typeof mountTable>) =>
  cards(t).map((card) =>
    [...card.querySelectorAll('.data-table__field')].map(
      (f) => `${text(f.querySelector('.data-table__field-label'))}=${text(f.querySelector('.data-table__field-value'))}`,
    ),
  );
const titles = (t: ReturnType<typeof mountTable>) => [...t.element.querySelectorAll('.data-table__card-title')].map((e) => text(e));

describe('a card shows its name once: as the title, not again as a field (#205)', () => {
  const COLUMNS = [{ key: 'code', label: 'Código' }, { key: 'name', label: 'Nombre' }, { key: 'currency', label: 'Divisa' }];
  const base = {
    rows: [{ id: '1', code: 'L1', name: 'Tarifa mayorista 1', currency: 'EUR' }],
    columns: COLUMNS,
    views: true,
    defaultView: 'cards',
    cardTitle: (r: Row) => String(r.name ?? r.code ?? '—'),
  };

  it('leaves the title column out of the body, per card', async () => {
    const t = mountTable({ ...base, rows: [...base.rows, { id: '2', code: 'L2', name: null, currency: 'USD' }] });
    await settle();
    expect(titles(t)).toEqual(['Tarifa mayorista 1', 'L2']);
    expect(fields(t)).toEqual([['Código=L1', 'Divisa=EUR'], ['Nombre=', 'Divisa=USD']]);
  });

  it('matches what the cell SHOWS (formatted, numeric, trimmed), and only ONE field', async () => {
    const formatted = mountTable({
      ...base,
      rows: [{ id: '1', first: 'Ana', last: 'García', phone: '600 000 000' }],
      columns: [{ key: 'full', label: 'Cliente', format: (_v: unknown, r: Row) => `${String(r.first)} ${String(r.last)}` }, { key: 'phone', label: 'Teléfono' }],
      cardTitle: (r: Row) => `${String(r.first)} ${String(r.last)}`,
    });
    const numeric = mountTable({ ...base, rows: [{ id: '1', number: 12, seats: 4 }], columns: [{ key: 'number', label: 'Mesa' }, { key: 'seats', label: 'Plazas' }], cardTitle: (r: Row) => r.number });
    const twice = mountTable({ ...base, rows: [{ id: '1', code: 'VIP', name: 'VIP', currency: 'EUR' }] });
    await settle();
    expect(fields(formatted)).toEqual([['Teléfono=600 000 000']]);
    expect(fields(numeric)).toEqual([['Plazas=4']]);
    expect(fields(twice)).toEqual([['Nombre=VIP', 'Divisa=EUR']]);
  });

  it('keeps every field for an empty title, and a column painted by a slot', async () => {
    const empty = mountTable({ ...base, rows: [{ id: '1', code: 'L1', name: '', currency: 'EUR' }], cardTitle: (r: Row) => r.name });
    const slotted = mountTable(
      { ...base, columns: [COLUMNS[0], { ...COLUMNS[1], cell: 'name' }] },
      { slots: { name: '<template #name="{ value }"><em>{{ value }}</em></template>' } },
    );
    await settle();
    expect(fields(empty)).toEqual([['Código=L1', 'Nombre=', 'Divisa=EUR']]);
    expect(fields(slotted)).toEqual([['Código=L1', 'Nombre=Tarifa mayorista 1']]);
    expect(slotted.find('.data-table__field-value em').text()).toBe('Tarifa mayorista 1');
  });

  it('a format that returns something that is not text still paints the cards', async () => {
    const t = mountTable({
      ...base,
      rows: [{ id: '1', code: 'L1', name: 'Tarifa mayorista 1', priority: 7 }],
      columns: [{ key: 'code', label: 'Código', format: () => undefined }, { key: 'priority', label: 'Prioridad', format: (_v: unknown, r: Row) => r.priority }, { key: 'name', label: 'Nombre' }],
    });
    await settle();
    expect(titles(t)).toEqual(['Tarifa mayorista 1']);
    expect(fields(t)).toEqual([['Código=', 'Prioridad=7']]);
  });

  it('the `card` slot replaces the body (what `renderCard` did)', async () => {
    const t = mountTable(base, { slots: { card: '<template #card="{ row }"><p class="own">{{ row.code }} body</p></template>' } });
    await settle();
    expect(t.find('.data-table__card-body .own').text()).toBe('L1 body');
    expect(fields(t)).toEqual([[]]);
  });

  it('a hidden column is not a field either', async () => {
    const t = mountTable({ ...base, cardTitle: undefined, columns: [COLUMNS[0], { ...COLUMNS[2], hidden: true }] });
    await settle();
    expect(fields(t)).toEqual([['Código=L1']]);
  });
});

describe('the card head is ONE row, in ios too (#79)', () => {
  it('[icon] [title] [checkbox], in that order', async () => {
    const t = mountTable({
      rows: [{ id: '1', name: 'Menú del día', price: '13,50 €' }],
      columns: [{ key: 'name', label: 'Nombre' }, { key: 'price', label: 'Precio' }],
      cardTitle: (r: Row) => r.name,
      cardIcon: () => 'restaurant-outline',
      selectable: true,
      views: true,
      defaultView: 'cards',
    });
    await settle();
    const head = t.find('.data-table__card-head').element;
    const kinds = [...head.children].map((el) =>
      el.classList.contains('data-table__card-icon') ? 'icon' : el.classList.contains('data-table__card-title') ? 'title' : el.localName,
    );
    expect(kinds).toEqual(['icon', 'title', 'ion-checkbox']);
    expect(head.querySelector('ion-checkbox')?.getAttribute('aria-label')).toBe('Select');
  });

  it('no title, icon nor selection: no head at all', async () => {
    const t = mountTable({ rows: [{ id: '1', name: 'A' }], columns: [{ key: 'name', label: 'Nombre' }], views: true, defaultView: 'cards' });
    await settle();
    expect(t.find('.data-table__card-head').exists()).toBe(false);
  });
});

describe('the card opens the record like the row (#74)', () => {
  const ROWS = [{ id: '1', name: 'Menú del día' }, { id: '2', name: 'Menú degustación' }];
  const base = { rows: ROWS, columns: [{ key: 'name', label: 'Nombre' }], actions: [{ id: 'edit', label: 'Editar' }], views: true, defaultView: 'cards' };

  it('`rowClickable`: the card, its body and its title open it; it looks and acts as a button', async () => {
    const t = mountTable({ ...base, rowClickable: true, selectable: true, cardTitle: (r: Row) => r.name });
    await settle();
    await click(cards(t)[1]);
    await click(cards(t)[0].querySelector('.data-table__card-body'));
    await click(cards(t)[0].querySelector('.data-table__card-title'));
    expect(t.emitted('rowClick')).toEqual([[ROWS[1]], [ROWS[0]], [ROWS[0]]]);
    const card = cards(t)[0];
    expect(card.classList.contains('data-table__card--clickable')).toBe(true);
    expect(card.getAttribute('tabindex')).toBe('0');
    expect(card.getAttribute('role')).toBe('button');
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    card.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(t.emitted('rowClick')).toHaveLength(5);
  });

  it('without it the card stays mute', async () => {
    const t = mountTable(base);
    await settle();
    await click(cards(t)[0]);
    expect(t.emitted('rowClick')).toBeUndefined();
    expect(cards(t)[0].hasAttribute('tabindex')).toBe(false);
    expect(cards(t)[0].hasAttribute('role')).toBe(false);
  });

  it('a card action or its checkbox does not also open the record; the checkbox selects', async () => {
    const t = mountTable({ ...base, rowClickable: true, selectable: true });
    await settle();
    await click(cards(t)[0].querySelector('.data-table__card-actions ion-button'));
    await click(cards(t)[0].querySelector('ion-checkbox'));
    expect(t.emitted('rowClick')).toBeUndefined();
    expect(t.emitted('action')).toEqual([[{ actionId: 'edit', row: ROWS[0] }]]);
    const selecting = mountTable({ ...base, selectable: true });
    await settle();
    await ionChange(cards(selecting)[0].querySelector('ion-checkbox') as HTMLElement);
    expect(cards(selecting)[0].classList.contains('data-table__card--selected')).toBe(true);
    expect(selecting.emitted('update:selected')).toEqual([[['1']]]);
  });

  it('every action of a busy card is there (the row wraps instead of clipping, see the visual test)', async () => {
    const actions = Array.from({ length: 8 }, (_, i) => ({ id: `a${i}`, label: `Action ${i}`, icon: 'ellipse' }));
    const t = mountTable({ ...base, actions });
    await settle();
    expect(cards(t)[0].querySelectorAll('.data-table__card-actions ion-button')).toHaveLength(8);
  });
});

// FIX-UI-DATATABLE-CARD-LONG-VALUE-CLIP (hub#91): on a phone a 54-character email ran past the right
// edge of its card, cut with no «…». The default text is its own box, which clips with «…» (the rules
// are in the visual test) and, as a table cell does (#217), carries its whole text: the title, and a
// tap that unfolds it in place when the card opens nothing.
describe('a card value too long for its card can be read in full', () => {
  const EMAIL = 'e2e.card.value.with.a.long.address.no.spaces@example.com';
  const ROWS = [
    { id: '1', name: 'Ana', email: EMAIL, phone: '' },
    { id: '2', name: 'Bea', email: 'bea@example.com', phone: null },
  ];
  const COLUMNS = [{ key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' }];
  const base = { rows: ROWS, columns: COLUMNS, views: true, defaultView: 'cards', cardTitle: (r: Row) => r.name, testid: 'staff' };
  /** The default text of a field, by its card and its label. */
  const value = (t: ReturnType<typeof mountTable>, id: string, label: string) =>
    [...(t.element.querySelector(`[data-testid="staff-row"][data-id="${id}"]`)?.querySelectorAll('.data-table__field') ?? [])]
      .find((f) => text(f.querySelector('.data-table__field-label')) === label)
      ?.querySelector('.data-table__field-value > .data-table__field-text') as HTMLElement;
  const clip = (el: HTMLElement, clipped: boolean) => {
    Object.defineProperty(el, 'scrollWidth', { configurable: true, get: () => (clipped ? 380 : 90) });
    Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => 90 });
  };
  async function tap(el: HTMLElement, pointerType: 'touch' | 'mouse') {
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType }));
    await click(el);
  }

  it('the default text is its own box, with the whole painted (formatted) text as title; an empty one has none', async () => {
    const t = mountTable({ ...base, columns: [COLUMNS[0], { ...COLUMNS[1], format: (v: unknown) => `<${String(v)}>` }, COLUMNS[2]] });
    await settle();
    expect(value(t, '1', 'Email').textContent).toBe(`<${EMAIL}>`);
    expect(value(t, '1', 'Email').getAttribute('title')).toBe(`<${EMAIL}>`);
    expect(value(t, '1', 'Phone').hasAttribute('title')).toBe(false);
    expect(value(t, '2', 'Phone').hasAttribute('title')).toBe(false);
  });

  it('a slot paints the value as it is: no box of ours around it, no title', async () => {
    const t = mountTable({ ...base, columns: [COLUMNS[0], { ...COLUMNS[1], cell: 'email' }] }, { slots: { email: '<template #email="{ value }"><a class="own">{{ value }}</a></template>' } });
    await settle();
    const cell = cards(t)[0].querySelectorAll('.data-table__field-value')[0] as HTMLElement;
    expect([...cell.children].map((el) => el.className)).toEqual(['own']);
    expect(cell.hasAttribute('title')).toBe(false);
  });

  it('touch, cards that open nothing: a tap on a clipped value unfolds only that value', async () => {
    const t = mountTable(base);
    await settle();
    clip(value(t, '1', 'Email'), true);
    await tap(value(t, '1', 'Email'), 'touch');
    expect(value(t, '1', 'Email').className).toBe('data-table__field-text data-table__field-text--unfolded');
    expect(value(t, '1', 'Phone').className).toBe('data-table__field-text');
    expect(value(t, '2', 'Email').className).toBe('data-table__field-text');
    expect(t.emitted('rowClick')).toBeUndefined();
  });

  it('a value that fits, a mouse click, or cards that open a record never unfold', async () => {
    const t = mountTable(base);
    await settle();
    clip(value(t, '2', 'Email'), false);
    await tap(value(t, '2', 'Email'), 'touch');
    clip(value(t, '1', 'Email'), true);
    await tap(value(t, '1', 'Email'), 'mouse');
    expect(t.findAll('.data-table__field-text--unfolded')).toHaveLength(0);

    const opening = mountTable({ ...base, rowClickable: true });
    await settle();
    clip(value(opening, '1', 'Email'), true);
    await tap(value(opening, '1', 'Email'), 'touch');
    expect(opening.findAll('.data-table__field-text--unfolded')).toHaveLength(0);
    expect(opening.emitted('rowClick')).toEqual([[ROWS[0]]]);
  });
});

// hub-next apps/tax/UI-REQUESTS.md: in Rules the card title is the category's NAME and the column is
// its KEY, so the text match of #205 cannot find it and the key was repeated in the body.
describe('cardTitleColumn: the column the card title stands for', () => {
  const COLUMNS = [
    { key: 'category', label: 'Category' },
    { key: 'rate', label: 'Rate', format: (v: unknown) => `${String(v)} %` },
    { key: 'region', label: 'Region' },
  ];
  const ROW = { id: '1', category: 'VAT_STD', category_name: 'Standard VAT', rate: 21, region: 'ES' };
  const base = { rows: [ROW], columns: COLUMNS, views: true, defaultView: 'cards' };

  it('leaves that column out of the body even when the title text is not its text', async () => {
    const t = mountTable({ ...base, cardTitle: (r: Row) => r.category_name, cardTitleColumn: 'category' });
    await settle();
    expect(titles(t)).toEqual(['Standard VAT']);
    expect(fields(t)).toEqual([['Rate=21 %', 'Region=ES']]);
  });

  it('without cardTitle, the title is the painted text of that column', async () => {
    const t = mountTable({ ...base, cardTitleColumn: 'rate' });
    await settle();
    expect(t.find('.data-table__card-head').exists()).toBe(true);
    expect(titles(t)).toEqual(['21 %']);
    expect(fields(t)).toEqual([['Category=VAT_STD', 'Region=ES']]);
  });

  it('names one column only: another column with the same text as the title stays in the body', async () => {
    const t = mountTable({
      ...base,
      rows: [{ ...ROW, region: 'Standard VAT' }],
      cardTitle: (r: Row) => r.category_name,
      cardTitleColumn: 'category',
    });
    await settle();
    expect(fields(t)).toEqual([['Rate=21 %', 'Region=Standard VAT']]);
  });

  it('a key that is not a column changes nothing (the #205 text match still applies)', async () => {
    const t = mountTable({ ...base, rows: [{ ...ROW, region: 'Standard VAT' }], cardTitle: (r: Row) => r.category_name, cardTitleColumn: 'nope' });
    await settle();
    expect(fields(t)).toEqual([['Category=VAT_STD', 'Rate=21 %']]);
  });
});
