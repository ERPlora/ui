// DataTable column filters (hub-next apps/tax/UI-REQUESTS.md; the inline filters of `ok-data-table`):
// a column declares `filter` and the table paints a filter row under its toolbar, one Ionic control
// per filtered column (free text «contains», a closed domain by equality, a day, a numeric range),
// with «Clear filters» while any filters. Client mode filters `rows`; server mode emits
// `filtersChange` with `{ name: value }`; both keep `v-model:filters`.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { byTestId, cards, click, crossBreakpoint, dataRows, ionChange, mountTable, settle, text, type, viewport } from './__tests__/harness';

beforeEach(() => {
  viewport(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

type Row = Record<string, unknown>;

const STATUS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];
const COLUMNS = [
  { key: 'name', label: 'Name', filter: { type: 'text' } },
  { key: 'status', label: 'Status', filter: { type: 'select', options: STATUS } },
  { key: 'rate', label: 'Rate', filter: { type: 'range' } },
  { key: 'day', label: 'Day', filter: { type: 'date' } },
  { key: 'note', label: 'Note' },
];
const ROWS: Row[] = [
  { id: '1', name: 'Ana García', status: 'active', rate: 21, day: '2026-10-14', note: 'x' },
  { id: '2', name: 'Luis Ana', status: 'inactive', rate: 10, day: '2026-10-13', note: 'y' },
  { id: '3', name: 'Marta', status: 'active', rate: 4, day: '2026-10-14', note: 'z' },
];

const base = { rows: ROWS, columns: COLUMNS, testid: 'rules', pageSizeOptions: [] };
const ids = (t: ReturnType<typeof mountTable>) => dataRows(t).map((row) => row.getAttribute('data-id'));
const control = (t: ReturnType<typeof mountTable>, name: string) => byTestId(t, `rules-filter-${name}`)[0] as HTMLElement & { value?: unknown };
const clearChip = (t: ReturnType<typeof mountTable>) => byTestId(t, 'rules-filters-clear')[0] as HTMLElement | undefined;
/** Stencil's slot patch hides `textContent` of ion-label under happy-dom: read its markup. */
const chipText = (t: ReturnType<typeof mountTable>) => clearChip(t)?.querySelector('ion-label')?.innerHTML.trim();

/** What Ionic sends while the person types in an ion-input (debounced by Ionic itself). */
async function typeIn(el: HTMLElement, value: string): Promise<void> {
  el.dispatchEvent(new CustomEvent('ionInput', { detail: { value } }));
  await settle();
}
/** What Ionic sends when a select or a date input commits a value. */
async function change(el: HTMLElement, value: unknown): Promise<void> {
  el.dispatchEvent(new CustomEvent('ionChange', { detail: { value } }));
  await settle();
}

describe('the filter row', () => {
  it('sits in the toolbar area, under its main row, named for assistive tech, one control per filtered column in order', async () => {
    const t = mountTable(base);
    await settle();
    const row = byTestId(t, 'rules-filters')[0];
    expect(row.classList.contains('data-table__filters')).toBe(true);
    expect(row.parentElement?.classList.contains('data-table__bar')).toBe(true);
    expect(row.previousElementSibling?.classList.contains('data-table__bar-main')).toBe(true);
    expect(row.getAttribute('role')).toBe('group');
    expect(row.getAttribute('aria-label')).toBe('Filters');
    const names = [...row.querySelectorAll('[data-testid^="rules-filter-"]')].map((el) => el.getAttribute('data-testid'));
    expect(names).toEqual(['rules-filter-name', 'rules-filter-status', 'rules-filter-rate_from', 'rules-filter-rate_to', 'rules-filter-day']);
  });

  it('no filtered column, no filter row (and no toolbar of its own)', async () => {
    const t = mountTable({ rows: ROWS, columns: [{ key: 'name', label: 'Name' }], testid: 'rules', columnPicker: false, pageSizeOptions: [] });
    await settle();
    expect(byTestId(t, 'rules-filters')).toHaveLength(0);
    expect(t.find('.data-table__bar').exists()).toBe(false);
  });

  it('a filtered column is enough for the toolbar to exist', async () => {
    const t = mountTable({ rows: ROWS, columns: [COLUMNS[0]], testid: 'rules', columnPicker: false, pageSizeOptions: [] });
    await settle();
    expect(t.find('.data-table__bar .data-table__filters').exists()).toBe(true);
  });

  it('free text is an ion-input named and hinted by its column, cleared with its own button', async () => {
    const t = mountTable(base);
    await settle();
    const name = control(t, 'name');
    expect(name.localName).toBe('ion-input');
    expect(name.classList.contains('data-table__filter')).toBe(true);
    expect(name.getAttribute('aria-label')).toBe('Name');
    expect((name as HTMLElement & { placeholder?: string }).placeholder).toBe('Name');
    expect((name as HTMLElement & { clearInput?: boolean }).clearInput).toBe(true);
    expect((name as HTMLElement & { debounce?: number }).debounce).toBe(250);
  });

  it('a closed domain is an ion-select (popover) with «All» first and its options', async () => {
    const t = mountTable(base);
    await settle();
    const status = control(t, 'status');
    expect(status.localName).toBe('ion-select');
    expect(status.classList.contains('data-table__filter')).toBe(true);
    expect((status as HTMLElement & { interface?: string }).interface).toBe('popover');
    expect(status.getAttribute('aria-label')).toBe('Status');
    expect((status as HTMLElement & { placeholder?: string }).placeholder).toBe('Status');
    const options = [...status.querySelectorAll('ion-select-option')].map((o) => [(o as HTMLElement & { value?: string }).value, text(o)]);
    expect(options).toEqual([
      ['', 'All'],
      ['active', 'Active'],
      ['inactive', 'Inactive'],
    ]);
    // Unfiltered: «All» is the value, and the select reads as its column («Status»), not «All».
    expect(status.value).toBe('');
    expect((status as HTMLElement & { selectedText?: string }).selectedText).toBe('Status');
    await change(status, 'active');
    expect(status.value).toBe('active');
    // Vue writes '' for undefined, and Ionic reads an empty selectedText as none: the option's label shows.
    expect((status as HTMLElement & { selectedText?: string }).selectedText).toBeFalsy();
  });

  it('a range is two number inputs, From and To, grouped and named by the column', async () => {
    const t = mountTable(base);
    await settle();
    const from = control(t, 'rate_from');
    const to = control(t, 'rate_to');
    for (const end of [from, to]) {
      expect(end.localName).toBe('ion-input');
      expect((end as HTMLElement & { type?: string }).type).toBe('number');
    }
    expect((from as HTMLElement & { placeholder?: string }).placeholder).toBe('From');
    expect((to as HTMLElement & { placeholder?: string }).placeholder).toBe('To');
    expect(from.getAttribute('aria-label')).toBe('Rate: from');
    expect(to.getAttribute('aria-label')).toBe('Rate: to');
    const group = from.closest('.data-table__filter-range');
    expect(group?.getAttribute('role')).toBe('group');
    expect(group?.getAttribute('aria-label')).toBe('Rate');
    expect(to.closest('.data-table__filter-range')).toBe(group);
  });

  it('a day is a date input', async () => {
    const t = mountTable(base);
    await settle();
    expect((control(t, 'day') as HTMLElement & { type?: string }).type).toBe('date');
    expect(control(t, 'day').getAttribute('aria-label')).toBe('Day');
  });

  it('speaks Spanish: «Filtros», «Todos», «Desde»/«Hasta», «Limpiar filtros»', async () => {
    const t = mountTable({ ...base, filters: { status: 'active' } }, { locale: 'es' });
    await settle();
    expect(byTestId(t, 'rules-filters')[0].getAttribute('aria-label')).toBe('Filtros');
    expect(text(control(t, 'status').querySelector('ion-select-option'))).toBe('Todos');
    expect((control(t, 'rate_from') as HTMLElement & { placeholder?: string }).placeholder).toBe('Desde');
    expect((control(t, 'rate_to') as HTMLElement & { placeholder?: string }).placeholder).toBe('Hasta');
    expect(control(t, 'rate_from').getAttribute('aria-label')).toBe('Rate: desde');
    expect(chipText(t)).toBe('Limpiar filtros');
  });
});

describe('client mode filters the rows', () => {
  it('free text by «contains» (Ana finds Ana García and Luis Ana)', async () => {
    const t = mountTable(base);
    await settle();
    await typeIn(control(t, 'name'), 'ana');
    expect(ids(t)).toEqual(['1', '2']);
    expect(t.emitted('update:filters')).toEqual([[{ name: 'ana' }]]);
    expect(t.emitted('filtersChange')).toBeUndefined();
  });

  it('a closed domain by equality, and «All» lifts it', async () => {
    const t = mountTable(base);
    await settle();
    await change(control(t, 'status'), 'active');
    expect(ids(t)).toEqual(['1', '3']);
    await change(control(t, 'status'), '');
    expect(ids(t)).toEqual(['1', '2', '3']);
    expect(t.emitted('update:filters')).toEqual([[{ status: 'active' }], [{}]]);
  });

  it('a range and a day, together with the others (AND) and with the search', async () => {
    const t = mountTable({ ...base, searchKeys: ['name'] });
    await settle();
    await typeIn(control(t, 'rate_from'), '5');
    expect(ids(t)).toEqual(['1', '2']);
    await change(control(t, 'day'), '2026-10-14');
    expect(ids(t)).toEqual(['1']);
    await type(t, 'marta');
    expect(ids(t)).toEqual([]);
    expect(text(t.element.querySelector('.data-table__empty'))).toContain('No results match your search or filters');
  });

  it('goes back to the first page when a filter changes', async () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ id: String(i + 1), name: `Row ${i + 1}`, status: i % 2 ? 'active' : 'inactive', rate: i, day: '2026-10-14', note: '' }));
    const t = mountTable({ ...base, rows: many, pageSize: 10, pageSizeOptions: [10] });
    await settle();
    await click(t.element.querySelector('[data-testid="rules-page-next"]'));
    expect(ids(t)[0]).toBe('11');
    await change(control(t, 'status'), 'active');
    expect(ids(t)[0]).toBe('2');
  });

  it('`v-model:filters`: the parent’s filters are painted in the controls and filter the rows', async () => {
    const t = mountTable({ ...base, filters: { status: 'inactive', rate_to: '15' } });
    await settle();
    expect(control(t, 'status').value).toBe('inactive');
    expect(control(t, 'rate_to').value).toBe('15');
    expect(ids(t)).toEqual(['2']);
    await t.setProps({ filters: {} });
    await settle();
    expect(ids(t)).toEqual(['1', '2', '3']);
    // Unfiltered, «All» is the checked option and the select reads as its column.
    expect(control(t, 'status').value).toBe('');
    expect((control(t, 'status') as HTMLElement & { selectedText?: string }).selectedText).toBe('Status');
  });
});

describe('«Clear filters»', () => {
  it('appears only while some filter filters, and lifts them all at once', async () => {
    const t = mountTable(base);
    await settle();
    expect(clearChip(t)).toBeUndefined();
    await change(control(t, 'status'), 'active');
    await typeIn(control(t, 'rate_to'), '10');
    const chip = clearChip(t)!;
    expect(chip.localName).toBe('ion-chip');
    expect(chip.classList.contains('data-table__filters-clear')).toBe(true);
    expect(chipText(t)).toBe('Clear filters');
    expect(chip.getAttribute('role')).toBe('button');
    expect(chip.getAttribute('tabindex')).toBe('0');
    expect(ids(t)).toEqual(['3']);
    await click(chip);
    expect(ids(t)).toEqual(['1', '2', '3']);
    expect(clearChip(t)).toBeUndefined();
    expect(t.emitted('update:filters')?.at(-1)).toEqual([{}]);
  });

  it('a blank text is no filter: no chip for it', async () => {
    const t = mountTable(base);
    await settle();
    await typeIn(control(t, 'name'), '   ');
    expect(clearChip(t)).toBeUndefined();
    expect(ids(t)).toEqual(['1', '2', '3']);
  });

  it('Enter and Space on the chip clear too (it is a button for the keyboard)', async () => {
    const t = mountTable({ ...base, filters: { status: 'active' } });
    await settle();
    clearChip(t)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle();
    expect(t.emitted('update:filters')).toEqual([[{}]]);
    await t.setProps({ filters: { status: 'active' } });
    await settle();
    clearChip(t)!.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    await settle();
    expect(t.emitted('update:filters')).toEqual([[{}], [{}]]);
  });

  it('«Show all» of a list emptied by its filters drops the search and the filters', async () => {
    const t = mountTable({ ...base, searchKeys: ['name'] });
    await settle();
    await change(control(t, 'status'), 'inactive');
    await type(t, 'marta');
    expect(ids(t)).toEqual([]);
    await click(byTestId(t, 'rules-show-all')[0]);
    expect(ids(t)).toEqual(['1', '2', '3']);
    expect(t.emitted('update:filters')?.at(-1)).toEqual([{}]);
  });
});

describe('server mode asks for the filtered rows', () => {
  const server = { ...base, serverSide: true, total: 3, pageSizeOptions: [10] };

  it('emits filtersChange with every active filter by name (not again for a change that filters nothing new), and never filters `rows` itself', async () => {
    const t = mountTable(server);
    await settle();
    await change(control(t, 'status'), 'active');
    await typeIn(control(t, 'rate_from'), '5');
    await typeIn(control(t, 'name'), '  ');
    expect(t.emitted('filtersChange')).toEqual([[{ status: 'active' }], [{ status: 'active', rate_from: '5' }]]);
    expect(t.emitted('update:filters')).toHaveLength(2);
    expect(ids(t)).toEqual(['1', '2', '3']);
    await click(clearChip(t));
    expect(t.emitted('filtersChange')?.at(-1)).toEqual([{}]);
  });

  it('keeps its toolbar and filters when the filters leave nothing (hideToolbarWhenEmpty), so they can be lifted', async () => {
    const t = mountTable({ ...server, rows: [], total: 0, hideToolbarWhenEmpty: true, filters: { status: 'inactive' } });
    await settle();
    expect(byTestId(t, 'rules-filters')).toHaveLength(1);
    expect(clearChip(t)).toBeDefined();
  });

  it('with no filter and no record at all, hideToolbarWhenEmpty still paints the empty state alone', async () => {
    const t = mountTable({ ...server, rows: [], total: 0, hideToolbarWhenEmpty: true });
    await settle();
    expect(byTestId(t, 'rules-filters')).toHaveLength(0);
  });
});

// ── In the cards the column filters fold behind the funnel: an open row of controls under the toolbar took
// half a phone before the first card, where the old table kept them behind its funnel
// (docs/reference/old-hub/cart_checkout-carts-390.png). Whenever the table paints cards (picked, the default
// or forced by `cardBreakpoint`) they behave as with `filterable`: the same funnel and count, the same panel
// (the modal sheet below 834 px, outfitkit#75), the same `filters` and `filtersChange`. The table view keeps
// its row as before, and a filter in use survives every switch.
describe('in the card view the column filters fold behind the funnel', () => {
  const funnel = (t: ReturnType<typeof mountTable>) => byTestId(t, 'rules-filters-toggle')[0] as HTMLElement | undefined;
  const panel = (t: ReturnType<typeof mountTable>) => byTestId(t, 'rules-filters-panel')[0] as HTMLElement | undefined;
  const count = (t: ReturnType<typeof mountTable>) => byTestId(t, 'rules-filters-count')[0] as HTMLElement | undefined;
  const filterRow = (t: ReturnType<typeof mountTable>) => byTestId(t, 'rules-filters');
  const cardIds = (t: ReturnType<typeof mountTable>) => cards(t).map((c) => c.getAttribute('data-id'));
  const pick = (t: ReturnType<typeof mountTable>, view: 'table' | 'cards') =>
    ionChange(t.element.querySelector('.data-table__view-segment') as HTMLElement, { value: view });

  it('cards by default, without `filterable`: no filter row, a funnel whose panel filters the cards and closes on «Apply» (outfitkit#207)', async () => {
    const t = mountTable({ ...base, views: true, defaultView: 'cards' }, { attachTo: document.body });
    await settle();
    expect(cards(t)).toHaveLength(3);
    expect(filterRow(t)).toHaveLength(0);
    expect(funnel(t)).toBeDefined();
    expect(count(t)).toBeUndefined();
    await click(funnel(t));
    expect(panel(t)).toBeDefined();
    await change(control(t, 'status'), 'inactive');
    expect(cardIds(t)).toEqual(['1', '2', '3']);
    await click(byTestId(t, 'rules-filters-apply')[0]);
    expect(cardIds(t)).toEqual(['2']);
    expect(panel(t)).toBeUndefined();
    expect(text(count(t))).toBe('1');
    expect(t.emitted('update:filters')).toEqual([[{ status: 'inactive' }]]);
  });

  it('cards picked by hand fold the row; the list again opens it', async () => {
    const t = mountTable({ ...base, views: true });
    await settle();
    expect(filterRow(t)).toHaveLength(1);
    await pick(t, 'cards');
    expect(cards(t)).toHaveLength(3);
    expect(filterRow(t)).toHaveLength(0);
    expect(funnel(t)).toBeDefined();
    await pick(t, 'table');
    expect(filterRow(t)).toHaveLength(1);
    expect(funnel(t)).toBeUndefined();
  });

  it('on a phone (cards forced by `cardBreakpoint`) the funnel opens the modal sheet (outfitkit#75)', async () => {
    viewport(true);
    const t = mountTable({ ...base, views: true }, { attachTo: document.body });
    await settle();
    expect(cards(t)).toHaveLength(3);
    expect(filterRow(t)).toHaveLength(0);
    await click(funnel(t));
    expect(panel(t)?.getAttribute('aria-modal')).toBe('true');
  });

  it('the table view, wide, without `filterable`: the filter row stays open and there is no funnel, as today', async () => {
    const t = mountTable({ ...base, views: true, defaultView: 'table' });
    await settle();
    expect(dataRows(t)).toHaveLength(3);
    expect(filterRow(t)).toHaveLength(1);
    expect(funnel(t)).toBeUndefined();
  });

  it('a filter in use survives the switch: the funnel counts it in the cards, the row shows it in the list, and nothing is asked again', async () => {
    const t = mountTable({ ...base, views: true, serverSide: true, total: 3, pageSizeOptions: [10] });
    await settle();
    await change(control(t, 'status'), 'inactive');
    expect(t.emitted('filtersChange')).toEqual([[{ status: 'inactive' }]]);
    await pick(t, 'cards');
    expect(filterRow(t)).toHaveLength(0);
    expect(text(count(t))).toBe('1');
    await pick(t, 'table');
    expect(control(t, 'status').value).toBe('inactive');
    expect(funnel(t)).toBeUndefined();
    expect(t.emitted('filtersChange')).toHaveLength(1);
  });

  it('crossing the phone breakpoint keeps the filter in use, folded in the cards and open again in the wide list', async () => {
    const t = mountTable({ ...base, views: true, filters: { status: 'active' } });
    await settle();
    expect(filterRow(t)).toHaveLength(1);
    crossBreakpoint(true);
    await settle();
    expect(cards(t)).toHaveLength(2);
    expect(filterRow(t)).toHaveLength(0);
    expect(text(count(t))).toBe('1');
    crossBreakpoint(false);
    await settle();
    expect(control(t, 'status').value).toBe('active');
    expect(dataRows(t).map((row) => row.getAttribute('data-id'))).toEqual(['1', '3']);
    expect(t.emitted('update:filters')).toBeUndefined();
  });

  it('a panel open in the cards closes when the list comes back, and what it applied stays', async () => {
    const t = mountTable({ ...base, views: true, defaultView: 'cards', filters: { status: 'inactive' } }, { attachTo: document.body });
    await settle();
    await click(funnel(t));
    expect(panel(t)).toBeDefined();
    await pick(t, 'table');
    expect(panel(t)).toBeUndefined();
    expect(filterRow(t)).toHaveLength(1);
    expect(control(t, 'status').value).toBe('inactive');
  });

  it('`filterable` stays behind the funnel in both views, as before', async () => {
    const t = mountTable({ ...base, views: true, filterable: true });
    await settle();
    expect(filterRow(t)).toHaveLength(0);
    expect(funnel(t)).toBeDefined();
    await pick(t, 'cards');
    expect(filterRow(t)).toHaveLength(0);
    expect(funnel(t)).toBeDefined();
  });

  it('a list without cards keeps its filter row on a phone (there is nothing to fold for)', async () => {
    viewport(true);
    const t = mountTable(base);
    await settle();
    expect(filterRow(t)).toHaveLength(1);
    expect(funnel(t)).toBeUndefined();
  });
});

// ── The filters panel (`filterable`): the old table's funnel, with the count of filters in use, opening a
// panel INSIDE the table (PLAN-MIGRATIONS §13, 2026-10-15; outfitkit's `.drawer`): two columns from 834 px
// (the list narrows, nothing is covered), a sheet over the content area below. The panel edits a draft:
// «Apply» applies it and closes, «Clear» lifts every filter at once, Close and Escape drop the draft.
describe('the filters panel (`filterable`)', () => {
  const panelBase = { ...base, filterable: true, views: true, addable: true };
  const funnel = (t: ReturnType<typeof mountTable>) => byTestId(t, 'rules-filters-toggle')[0] as HTMLElement & { fill?: string };
  const panel = (t: ReturnType<typeof mountTable>) => byTestId(t, 'rules-filters-panel')[0] as HTMLElement | undefined;
  const count = (t: ReturnType<typeof mountTable>) => byTestId(t, 'rules-filters-count')[0] as HTMLElement | undefined;
  const surface = (t: ReturnType<typeof mountTable>) => t.element.querySelector('.data-table__surface') as HTMLElement;
  /** An ARIA attribute of an Ionic control: once loaded, Ionic moves it from the host onto its native
   *  element (in its shadow root, or a light child for a scoped one such as ion-input). */
  const aria = (el: HTMLElement, name: string) =>
    el.getAttribute(name) ?? (el.shadowRoot ?? el).querySelector(`[${name}]`)?.getAttribute(name) ?? null;
  /** The `label` Ionic draws inside an input or a select (a property, not an attribute). */
  const fieldLabel = (el: HTMLElement) => (el as HTMLElement & { label?: string }).label;
  async function openPanel(t: ReturnType<typeof mountTable>): Promise<HTMLElement> {
    await click(funnel(t));
    return panel(t)!;
  }

  it('a funnel in the toolbar, after the list/cards switch and before «Add»; no filter row under the toolbar', async () => {
    const t = mountTable(panelBase);
    await settle();
    expect(byTestId(t, 'rules-filters')).toHaveLength(0);
    const bar = [...t.element.querySelector('.data-table__bar-main')!.children];
    const at = (el: Element | null) => bar.indexOf(el as Element);
    expect(at(funnel(t))).toBeGreaterThan(at(t.element.querySelector('.data-table__view-segment')));
    expect(at(funnel(t))).toBeLessThan(at(t.element.querySelector('.data-table__add-button')));
    expect(funnel(t).classList.contains('data-table__filter-button')).toBe(true);
    expect(aria(funnel(t), 'aria-label')).toBe('Filters');
    expect(aria(funnel(t), 'aria-pressed')).toBe('false');
    expect(funnel(t).fill).toBe('outline');
    expect(count(t)).toBeUndefined();
    expect(panel(t)).toBeUndefined();
  });

  it('without `filterable` the column filters keep their row and there is no funnel (the lists that use it today)', async () => {
    const t = mountTable(base);
    await settle();
    expect(byTestId(t, 'rules-filters')).toHaveLength(1);
    expect(byTestId(t, 'rules-filters-toggle')).toHaveLength(0);
  });

  it('`filterable` with no filtered column paints no funnel', async () => {
    const t = mountTable({ ...panelBase, columns: [{ key: 'name', label: 'Name' }] });
    await settle();
    expect(byTestId(t, 'rules-filters-toggle')).toHaveLength(0);
  });

  it('counts the filtered columns on the funnel (a range once) and says so to assistive tech', async () => {
    const t = mountTable({ ...panelBase, filters: { status: 'active', rate_from: '5', rate_to: '30' } });
    await settle();
    expect(text(count(t))).toBe('2');
    expect(count(t)!.getAttribute('aria-hidden')).toBe('true');
    expect(aria(funnel(t), 'aria-label')).toBe('Filters (2 active)');
    expect(funnel(t).fill).toBe('solid');
  });

  it('opens a panel inside the table: a named dialog with one labelled control per filtered column, in order, and the focus', async () => {
    const t = mountTable(panelBase, { attachTo: document.body });
    await settle();
    const dialog = await openPanel(t);
    expect(dialog.localName).toBe('aside');
    expect(dialog.classList.contains('data-table__drawer')).toBe(true);
    expect(dialog.getAttribute('role')).toBe('dialog');
    const title = t.element.querySelector(`#${dialog.getAttribute('aria-labelledby')}`);
    expect(text(title)).toBe('Filters');
    expect(dialog.parentElement).toBe(surface(t));
    expect(surface(t).classList.contains('data-table__surface--panel')).toBe(true);
    expect(aria(funnel(t), 'aria-pressed')).toBe('true');
    expect(document.activeElement === dialog, 'the focus is in the panel').toBe(true);
    const names = [...dialog.querySelectorAll('[data-testid^="rules-filter-"]')].map((el) => el.getAttribute('data-testid'));
    expect(names).toEqual(['rules-filter-name', 'rules-filter-status', 'rules-filter-rate_from', 'rules-filter-rate_to', 'rules-filter-day']);
    expect(fieldLabel(control(t, 'name'))).toBe('Name');
    expect(fieldLabel(control(t, 'status'))).toBe('Status');
    expect(fieldLabel(control(t, 'day'))).toBe('Day');
    expect((control(t, 'day') as HTMLElement & { type?: string }).type).toBe('date');
    expect(aria(control(t, 'rate_from'), 'aria-label')).toBe('Rate: from');
    // Ionic paints `fill` only in md (the shell pins ios): every control of the panel carries both.
    for (const el of dialog.querySelectorAll<HTMLElement & { fill?: string; mode?: string }>('ion-input, ion-select')) {
      expect(el.fill ?? el.getAttribute('fill'), el.getAttribute('data-testid') ?? '').toBe('outline');
      expect(el.mode ?? el.getAttribute('mode'), el.getAttribute('data-testid') ?? '').toBe('md');
    }
  });

  it('the panel edits a draft: nothing filters until «Apply», which applies, emits only the active filters and closes', async () => {
    const t = mountTable(panelBase, { attachTo: document.body });
    await settle();
    await openPanel(t);
    await change(control(t, 'status'), 'active');
    await typeIn(control(t, 'rate_to'), '10');
    await typeIn(control(t, 'name'), '  ');
    expect(ids(t)).toEqual(['1', '2', '3']);
    expect(t.emitted('update:filters')).toBeUndefined();
    await click(byTestId(t, 'rules-filters-apply')[0]);
    expect(ids(t)).toEqual(['3']);
    expect(t.emitted('update:filters')).toEqual([[{ status: 'active', rate_to: '10' }]]);
    expect(t.emitted('filtersChange')).toBeUndefined();
    expect(panel(t)).toBeUndefined();
    expect(surface(t).classList.contains('data-table__surface--panel')).toBe(false);
    expect(text(count(t))).toBe('2');
    expect(document.activeElement === funnel(t), 'the focus is back on the funnel').toBe(true);
  });

  it('«Clear» lifts every filter at once and keeps the panel open; with nothing to lift it is disabled', async () => {
    const t = mountTable({ ...panelBase, filters: { status: 'inactive' } }, { attachTo: document.body });
    await settle();
    await openPanel(t);
    const clear = () => byTestId(t, 'rules-filters-clear')[0] as HTMLButtonElement;
    expect(clear().disabled).toBe(false);
    await click(clear());
    expect(t.emitted('update:filters')).toEqual([[{}]]);
    expect(ids(t)).toEqual(['1', '2', '3']);
    expect(panel(t)).toBeDefined();
    expect(control(t, 'status').value).toBe('');
    expect(count(t)).toBeUndefined();
    expect(clear().disabled).toBe(true);
    await typeIn(control(t, 'name'), 'ana');
    expect(clear().disabled).toBe(false);
  });

  it('Close, Escape or the funnel again close it without applying; it opens again on what is applied', async () => {
    const t = mountTable({ ...panelBase, filters: { status: 'inactive' } }, { attachTo: document.body });
    await settle();
    for (const close of [
      () => click(byTestId(t, 'rules-filters-close')[0]),
      async () => {
        panel(t)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await settle();
      },
      () => click(funnel(t)),
    ]) {
      await openPanel(t);
      await change(control(t, 'status'), 'active');
      await close();
      expect(panel(t)).toBeUndefined();
      expect(document.activeElement === funnel(t), 'the focus is back on the funnel').toBe(true);
      expect(ids(t)).toEqual(['2']);
      await openPanel(t);
      expect(control(t, 'status').value).toBe('inactive');
      await click(byTestId(t, 'rules-filters-close')[0]);
    }
    expect(t.emitted('update:filters')).toBeUndefined();
  });

  it('below 834 px the panel is a modal sheet: Tab and Shift+Tab cycle inside it, and the trap goes with it', async () => {
    viewport(true);
    const t = mountTable(panelBase, { attachTo: document.body });
    await settle();
    const dialog = await openPanel(t);
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const close = byTestId(t, 'rules-filters-close')[0];
    const apply = byTestId(t, 'rules-filters-apply')[0];
    const tab = (from: HTMLElement, shiftKey = false) => {
      (from.shadowRoot?.querySelector('button') ?? from).focus();
      const ev = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
      from.dispatchEvent(ev);
      return ev;
    };
    expect(tab(apply).defaultPrevented).toBe(true);
    expect(document.activeElement === close, 'Tab on «Apply» goes back to «Close»').toBe(true);
    expect(tab(close, true).defaultPrevented).toBe(true);
    expect(document.activeElement === apply, 'Shift+Tab on «Close» goes to «Apply»').toBe(true);
  });

  it('from 834 px the panel sits beside the list: not modal, Tab leaves it', async () => {
    viewport(false);
    const t = mountTable(panelBase, { attachTo: document.body });
    await settle();
    const dialog = await openPanel(t);
    expect(dialog.hasAttribute('aria-modal')).toBe(false);
    const apply = byTestId(t, 'rules-filters-apply')[0];
    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    apply.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });

  it('an Escape a control inside already used (its own dropdown) leaves the panel open', async () => {
    const t = mountTable(panelBase, { attachTo: document.body });
    await settle();
    await openPanel(t);
    const used = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    used.preventDefault();
    control(t, 'status').dispatchEvent(used);
    await settle();
    expect(panel(t)).toBeDefined();
  });

  it('outfitkit#106: server mode with filters from outside (the address) paints them on the funnel and in the panel', async () => {
    const t = mountTable({ ...panelBase, serverSide: true, total: 3, pageSizeOptions: [10], filters: { status: 'active', rate_from: '5', day: '2026-10-14' } });
    await settle();
    expect(text(count(t))).toBe('3');
    await openPanel(t);
    expect(control(t, 'status').value).toBe('active');
    expect(control(t, 'rate_from').value).toBe('5');
    expect(control(t, 'day').value).toBe('2026-10-14');
    expect(control(t, 'name').value).toBe('');
    await typeIn(control(t, 'rate_from'), '');
    await click(byTestId(t, 'rules-filters-apply')[0]);
    expect(t.emitted('filtersChange')).toEqual([[{ status: 'active', day: '2026-10-14' }]]);
    expect(ids(t)).toEqual(['1', '2', '3']);
    expect(text(count(t))).toBe('2');
  });

  it('outfitkit#116: a name no column declares (a stale address parameter) is never sent nor counted', async () => {
    const t = mountTable({ ...panelBase, serverSide: true, total: 3, pageSizeOptions: [10], filters: { status: 'active', city: 'Madrid', name: ' ' } });
    await settle();
    expect(text(count(t))).toBe('1');
    await openPanel(t);
    await typeIn(control(t, 'name'), 'ana');
    await click(byTestId(t, 'rules-filters-apply')[0]);
    expect(t.emitted('filtersChange')).toEqual([[{ status: 'active', name: 'ana' }]]);
    expect(t.emitted('update:filters')).toEqual([[{ status: 'active', name: 'ana' }]]);
  });

  it('a change of the applied filters from outside while it is open is what the panel shows', async () => {
    const t = mountTable({ ...panelBase, filters: { status: 'inactive' } }, { attachTo: document.body });
    await settle();
    await openPanel(t);
    await t.setProps({ filters: { status: 'active' } });
    await settle();
    expect(control(t, 'status').value).toBe('active');
  });

  it('closes when its columns stop declaring filters (nothing left to filter, no funnel to come back to)', async () => {
    const t = mountTable(panelBase, { attachTo: document.body });
    await settle();
    await openPanel(t);
    await t.setProps({ columns: [{ key: 'name', label: 'Name' }] });
    await settle();
    expect(panel(t)).toBeUndefined();
    expect(surface(t).classList.contains('data-table__surface--panel')).toBe(false);
  });

  it('keeps the toolbar and its funnel when the filters leave nothing (hideToolbarWhenEmpty)', async () => {
    const t = mountTable({ ...panelBase, serverSide: true, rows: [], total: 0, hideToolbarWhenEmpty: true, filters: { status: 'inactive' } });
    await settle();
    expect(byTestId(t, 'rules-filters-toggle')).toHaveLength(1);
    expect(text(count(t))).toBe('1');
  });

  it('speaks Spanish: «Filtros», «Aplicar», «Limpiar», «Cerrar», the count, «Todos», «Desde»/«Hasta»', async () => {
    const t = mountTable({ ...panelBase, filters: { status: 'active' } }, { locale: 'es', attachTo: document.body });
    await settle();
    expect(aria(funnel(t), 'aria-label')).toBe('Filtros (1 activo)');
    await t.setProps({ filters: { status: 'active', name: 'a' } });
    await settle();
    expect(aria(funnel(t), 'aria-label')).toBe('Filtros (2 activos)');
    const dialog = await openPanel(t);
    expect(text(t.element.querySelector(`#${dialog.getAttribute('aria-labelledby')}`))).toBe('Filtros');
    expect(text(byTestId(t, 'rules-filters-apply')[0])).toBe('Aplicar');
    expect(text(byTestId(t, 'rules-filters-clear')[0])).toBe('Limpiar');
    expect(aria(byTestId(t, 'rules-filters-close')[0], 'aria-label')).toBe('Cerrar');
    expect(text(control(t, 'status').querySelector('ion-select-option'))).toBe('Todos');
    expect((control(t, 'rate_from') as HTMLElement & { placeholder?: string }).placeholder).toBe('Desde');
    expect((control(t, 'rate_to') as HTMLElement & { placeholder?: string }).placeholder).toBe('Hasta');
  });

  it('outfitkit#197: while open, the table publishes where the content area begins and ends (the phone sheet’s insets)', async () => {
    const ionPage = document.createElement('div');
    ionPage.className = 'ion-page';
    ionPage.getBoundingClientRect = () => ({ top: 0, bottom: 844 }) as DOMRect;
    const content = document.createElement('ion-content');
    content.getBoundingClientRect = () => ({ top: 56, bottom: 778 }) as DOMRect;
    ionPage.appendChild(content);
    document.body.appendChild(ionPage);
    const t = mountTable(panelBase, { attachTo: content });
    await settle();
    await openPanel(t);
    expect(t.element.style.getPropertyValue('--data-table-sheet-top')).toBe('56px');
    expect(t.element.style.getPropertyValue('--data-table-sheet-bottom')).toBe('66px');
    await click(byTestId(t, 'rules-filters-close')[0]);
    expect(t.element.style.getPropertyValue('--data-table-sheet-bottom')).toBe('');
  });
});

describe('the filter row sends only what the columns declare (outfitkit#116)', () => {
  it('a name no column declares, passed in by the parent, is not sent again nor offers «Clear filters»', async () => {
    const t = mountTable({ ...base, serverSide: true, total: 3, pageSizeOptions: [10], filters: { city: 'Madrid' } });
    await settle();
    expect(clearChip(t)).toBeUndefined();
    await change(control(t, 'status'), 'active');
    expect(t.emitted('filtersChange')).toEqual([[{ status: 'active' }]]);
  });
});

// ── The other filter types and the server's refusals (FIX-DATATABLE round 2: every Hub FilterPanel fits the
// table): a text with its longest length, a date range, a range with bounds or an amount as typed, a yes/no,
// a lookup that asks the server, and `filterErrors` (a 422's fieldErrors) under their controls.
describe('the other filter types', () => {
  const PEOPLE = [
    { value: '7', label: 'Ana García' },
    { value: '9', label: 'Luis Pérez' },
  ];
  const load = async (query: string) => PEOPLE.filter((p) => p.label.toLowerCase().includes(query.toLowerCase()));
  const MORE = [
    { key: 'code', label: 'Code', filter: { type: 'text', maxlength: 20 } },
    { key: 'issued', label: 'Issued', filter: { type: 'daterange' } },
    { key: 'total', label: 'Total', filter: { type: 'range', amount: true, keys: ['total_min', 'total_max'] } },
    { key: 'rate', label: 'Rate', filter: { type: 'range', min: 0, max: 100, step: 0.5 } },
    { key: 'active', label: 'Active', filter: { type: 'boolean', key: 'is_active' } },
    { key: 'user', label: 'User', filter: { type: 'lookup', key: 'user_id', load, selected: { value: '7', label: 'Ana García' } } },
  ];
  const MORE_ROWS: Row[] = [
    { id: '1', code: 'A-1', issued: '2026-10-01', total: 12.5, rate: 21, is_active: true, user_id: '7' },
    { id: '2', code: 'B-2', issued: '2026-10-10', total: 99, rate: 10, is_active: false, user_id: '9' },
    { id: '3', code: 'C-3', issued: '2026-10-20', total: 3, rate: 4, is_active: true, user_id: '9' },
  ];
  const more = { rows: MORE_ROWS, columns: MORE, testid: 'rules', pageSizeOptions: [] };
  const funnel = (t: ReturnType<typeof mountTable>) => byTestId(t, 'rules-filters-toggle')[0] as HTMLElement & { color?: string };
  const aria = (el: HTMLElement, name: string) =>
    el.getAttribute(name) ?? (el.shadowRoot ?? el).querySelector(`[${name}]`)?.getAttribute(name) ?? null;
  type Field = HTMLElement & { type?: string; inputmode?: string; maxlength?: number; min?: number; max?: number; step?: string | number; errorText?: string; value?: unknown };
  const field = (t: ReturnType<typeof mountTable>, name: string) => control(t, name) as Field;
  const invalid = (el: HTMLElement) => el.classList.contains('ion-invalid') && el.classList.contains('ion-touched');
  async function openPanel(t: ReturnType<typeof mountTable>): Promise<void> {
    await click(funnel(t));
  }

  it('in the panel: a text with its longest length, a date range, an amount as typed, a bounded range, a yes/no and a lookup', async () => {
    const t = mountTable({ ...more, filterable: true, filters: { user_id: '7' } }, { attachTo: document.body });
    await settle();
    await openPanel(t);
    expect(field(t, 'code').maxlength).toBe(20);
    expect(field(t, 'issued_from').type).toBe('date');
    expect(field(t, 'issued_to').type).toBe('date');
    expect(aria(field(t, 'issued_from'), 'aria-label')).toBe('Issued: from');
    expect([field(t, 'total_min').type, field(t, 'total_min').inputmode]).toEqual(['text', 'decimal']);
    expect([field(t, 'rate_from').type, field(t, 'rate_from').min, field(t, 'rate_from').max, String(field(t, 'rate_from').step)]).toEqual(['number', 0, 100, '0.5']);
    const yesNo = [...field(t, 'is_active').querySelectorAll('ion-select-option')];
    expect(yesNo.map((o) => [o.getAttribute('value') ?? (o as HTMLElement & { value?: string }).value, text(o)])).toEqual([
      ['', 'All'],
      ['true', 'Yes'],
      ['false', 'No'],
    ]);
    expect(control(t, 'user_id').classList.contains('data-table-lookup')).toBe(true);
    expect(text(byTestId(t, 'rules-filter-user_id-chosen')[0])).toBe('Ana García');
  });

  it('client mode: they filter the rows once applied (days, an amount with a comma, a yes/no, a lookup pick)', async () => {
    const t = mountTable({ ...more, filterable: true }, { attachTo: document.body });
    await settle();
    await openPanel(t);
    await change(field(t, 'issued_from'), '2026-10-05');
    await typeIn(field(t, 'total_max'), '99,0');
    await change(field(t, 'is_active'), 'false');
    const search = byTestId(t, 'rules-filter-user_id-search')[0] as HTMLInputElement;
    search.value = 'luis';
    search.dispatchEvent(new Event('input'));
    // The lookup asks 300 ms after the last key.
    await new Promise((resolve) => setTimeout(resolve, 320));
    await settle();
    await click(byTestId(t, 'rules-filter-user_id-option')[0]);
    expect(text(byTestId(t, 'rules-filter-user_id-chosen')[0])).toBe('Luis Pérez');
    await click(byTestId(t, 'rules-filters-apply')[0]);
    expect(t.emitted('update:filters')).toEqual([[{ issued_from: '2026-10-05', total_max: '99,0', is_active: 'false', user_id: '9' }]]);
    expect(ids(t)).toEqual(['2']);
    expect(text(byTestId(t, 'rules-filters-count')[0])).toBe('4');
  });

  it('the filter row paints them too, and applies them at once', async () => {
    const t = mountTable({ ...more, serverSide: true, total: 3, pageSizeOptions: [10] });
    await settle();
    expect(field(t, 'issued_to').type).toBe('date');
    expect(field(t, 'total_min').inputmode).toBe('decimal');
    expect(field(t, 'code').maxlength).toBe(20);
    expect(control(t, 'user_id').classList.contains('data-table-lookup')).toBe(true);
    await change(field(t, 'is_active'), 'true');
    await change(field(t, 'issued_to'), '2026-10-10');
    expect(t.emitted('filtersChange')).toEqual([[{ is_active: 'true' }], [{ is_active: 'true', issued_to: '2026-10-10' }]]);
  });

  it('`filterErrors`: the funnel says it, each message sits under its control, and a change of that value clears it', async () => {
    const errors = { total_min: 'Not an amount.', user_id: 'Unknown employee.' };
    const t = mountTable({ ...more, filterable: true, filters: { total_min: 'x', user_id: '4' }, filterErrors: errors }, { attachTo: document.body });
    await settle();
    expect(funnel(t).color).toBe('danger');
    expect(funnel(t).getAttribute('data-invalid')).toBe('true');
    expect(aria(funnel(t), 'aria-label')).toBe('Filters (check the marked ones)');
    await openPanel(t);
    expect(field(t, 'total_min').errorText).toBe('Not an amount.');
    expect(invalid(field(t, 'total_min'))).toBe(true);
    expect(invalid(field(t, 'total_max'))).toBe(false);
    expect(text(byTestId(t, 'rules-filter-user_id-field-error')[0])).toBe('Unknown employee.');
    await typeIn(field(t, 'total_min'), '5');
    expect(field(t, 'total_min').errorText).toBeFalsy();
    expect(invalid(field(t, 'total_min'))).toBe(false);
    expect(byTestId(t, 'rules-filter-user_id-field-error')).toHaveLength(1);
    // A new answer of the server is painted again.
    await t.setProps({ filterErrors: { total_min: 'Too small.' } });
    await settle();
    expect(field(t, 'total_min').errorText).toBe('Too small.');
    expect(byTestId(t, 'rules-filter-user_id-field-error')).toHaveLength(0);
    await t.setProps({ filterErrors: {} });
    await settle();
    expect(funnel(t).color).not.toBe('danger');
  });

  it('`filterErrors` in the filter row: under its control, cleared by a change of its value', async () => {
    const t = mountTable({ ...base, serverSide: true, total: 3, pageSizeOptions: [10], filters: { rate_from: 'x' }, filterErrors: { rate_from: 'Not a number.' } });
    await settle();
    expect(field(t, 'rate_from').errorText).toBe('Not a number.');
    expect(invalid(field(t, 'rate_from'))).toBe(true);
    await typeIn(field(t, 'rate_from'), '3');
    expect(field(t, 'rate_from').errorText).toBeFalsy();
  });

  it('speaks Spanish: «Sí»/«No», the refused funnel', async () => {
    const t = mountTable({ ...more, filterable: true, filterErrors: { code: 'Demasiado largo.' } }, { locale: 'es', attachTo: document.body });
    await settle();
    expect(aria(funnel(t), 'aria-label')).toBe('Filtros (revisa los marcados)');
    await openPanel(t);
    expect([...field(t, 'is_active').querySelectorAll('ion-select-option')].map(text)).toEqual(['Todos', 'Sí', 'No']);
  });
});

// ── Filters with no column of their own (`filterFields`, FIX-DATATABLE round 3): the Hub filters by fields it
// does not paint (customer `is_active`, dates, amounts). After the columns' own filters, in their order; they
// count, are sent (#116) and take `filterErrors`, and the column chooser never offers them.
describe('`filterFields`: filters with no column', () => {
  const FIELDS = [
    { key: 'is_active', label: 'Active', type: 'boolean' },
    { key: 'spent', label: 'Spent', type: 'range', amount: true },
  ];
  const ROWS_ACTIVE: Row[] = ROWS.map((row, i) => ({ ...row, is_active: i !== 1, spent_cents: 0 }));
  const withFields = { ...base, rows: ROWS_ACTIVE, filterFields: FIELDS };
  const panelNames = (t: ReturnType<typeof mountTable>) =>
    [...(byTestId(t, 'rules-filters-panel')[0] ?? t.element).querySelectorAll('[data-testid^="rules-filter-"]')].map((el) =>
      el.getAttribute('data-testid')?.replace('rules-filter-', ''),
    );

  it('in the panel after the columns’ own, counted on the funnel; never in the column chooser', async () => {
    const t = mountTable({ ...withFields, filterable: true, filters: { is_active: 'true', spent_from: '5' } }, { attachTo: document.body });
    await settle();
    expect(text(byTestId(t, 'rules-filters-count')[0])).toBe('2');
    const chooser = [...t.element.querySelectorAll('.data-table__columns-select ion-select-option')].map((o) => text(o));
    expect(chooser).toEqual(['Name', 'Status', 'Rate', 'Day', 'Note']);
    await click(byTestId(t, 'rules-filters-toggle')[0]);
    expect(panelNames(t)).toEqual(['name', 'status', 'rate_from', 'rate_to', 'day', 'is_active', 'spent_from', 'spent_to']);
    expect(control(t, 'is_active').value).toBe('true');
    expect(control(t, 'spent_from').value).toBe('5');
  });

  it('client mode filters the rows by the field; server mode sends it, and nothing undeclared (#116)', async () => {
    const t = mountTable({ ...withFields, filterable: true }, { attachTo: document.body });
    await settle();
    await click(byTestId(t, 'rules-filters-toggle')[0]);
    await change(control(t, 'is_active'), 'false');
    await click(byTestId(t, 'rules-filters-apply')[0]);
    expect(ids(t)).toEqual(['2']);
    const server = mountTable({ ...withFields, serverSide: true, total: 3, pageSizeOptions: [10], filters: { city: 'x' } });
    await settle();
    await change(control(server, 'is_active'), 'true');
    expect(server.emitted('filtersChange')).toEqual([[{ is_active: 'true' }]]);
  });

  it('the filter row paints them after the columns’ own, and `filterErrors` reaches them', async () => {
    const t = mountTable({ ...withFields, filterErrors: { spent_to: 'Not an amount.' }, filters: { spent_to: 'x' } });
    await settle();
    expect(panelNames(t).slice(-3)).toEqual(['is_active', 'spent_from', 'spent_to']);
    expect((control(t, 'spent_to') as HTMLElement & { errorText?: string }).errorText).toBe('Not an amount.');
    expect((control(t, 'spent_to') as HTMLElement & { inputmode?: string }).inputmode).toBe('decimal');
  });

  it('a field that repeats a column filter’s name is left out: one control per name, the column’s', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const t = mountTable({ ...withFields, filterable: true, filterFields: [{ key: 'status', label: 'Status again', type: 'text' }, ...FIELDS] }, { attachTo: document.body });
    await settle();
    await click(byTestId(t, 'rules-filters-toggle')[0]);
    expect(panelNames(t)).toEqual(['name', 'status', 'rate_from', 'rate_to', 'day', 'is_active', 'spent_from', 'spent_to']);
    expect(control(t, 'status').localName).toBe('ion-select');
    expect(warn.mock.calls.some((call) => String(call[0]).includes('Duplicate keys'))).toBe(false);
    warn.mockRestore();
  });

  it('fields alone (no column filters) still bring the funnel or the row', async () => {
    const t = mountTable({ rows: ROWS_ACTIVE, columns: [{ key: 'name', label: 'Name' }], testid: 'rules', filterable: true, filterFields: FIELDS });
    await settle();
    expect(byTestId(t, 'rules-filters-toggle')).toHaveLength(1);
    const row = mountTable({ rows: ROWS_ACTIVE, columns: [{ key: 'name', label: 'Name' }], testid: 'rules', filterFields: FIELDS });
    await settle();
    expect(byTestId(row, 'rules-filters')).toHaveLength(1);
  });
});
