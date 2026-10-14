// DataTable column filters (hub-next apps/tax/UI-REQUESTS.md; the inline filters of `ok-data-table`):
// a column declares `filter` and the table paints a filter row under its toolbar, one Ionic control
// per filtered column (free text «contains», a closed domain by equality, a day, a numeric range),
// with «Clear filters» while any filters. Client mode filters `rows`; server mode emits
// `filtersChange` with `{ name: value }`; both keep `v-model:filters`.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { byTestId, click, dataRows, mountTable, settle, text, type, viewport } from './__tests__/harness';

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

describe('in the card view', () => {
  it('the same filter row filters the cards', async () => {
    const t = mountTable({ ...base, views: true, defaultView: 'cards' });
    await settle();
    expect(byTestId(t, 'rules-filters')).toHaveLength(1);
    await change(control(t, 'status'), 'inactive');
    expect([...t.element.querySelectorAll('.data-table__card')].map((c) => c.getAttribute('data-id'))).toEqual(['2']);
  });
});
