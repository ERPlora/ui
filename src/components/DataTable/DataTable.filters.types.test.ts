import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { base, change, control, ids, pick, ROWS, typeIn } from './__tests__/filter-table';
import { byTestId, click, mountTable, settle, text, viewport } from './__tests__/harness';

beforeEach(() => {
  viewport(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

type Row = Record<string, unknown>;

// `filterErrors` are the `fieldErrors` of the server's 422, painted under their controls.
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
  type Field = HTMLElement & { readonly?: boolean; type?: string; inputmode?: string; maxlength?: number; min?: number; max?: number; step?: string | number; errorText?: string; value?: unknown };
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
    expect([field(t, 'issued_from').readonly, field(t, 'issued_to').readonly], 'a day is picked in the calendar, never typed').toEqual([true, true]);
    // Each end says «From» / «To» on screen, in a group named by its column.
    expect([(field(t, 'issued_from') as Field & { label?: string }).label, (field(t, 'issued_to') as Field & { label?: string }).label]).toEqual(['From', 'To']);
    expect(field(t, 'issued_from').closest('[role="group"]')?.getAttribute('aria-label')).toBe('Issued');
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
    await pick(t, 'issued_from', '2026-10-05');
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
    expect(field(t, 'issued_to').readonly, 'a day is picked in the calendar, never typed').toBe(true);
    expect(field(t, 'total_min').inputmode).toBe('decimal');
    expect(field(t, 'code').maxlength).toBe(20);
    expect(control(t, 'user_id').classList.contains('data-table-lookup')).toBe(true);
    await change(field(t, 'is_active'), 'true');
    await pick(t, 'issued_to', '2026-10-10');
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

  it('client mode filters the rows by the field; server mode sends it, and nothing undeclared', async () => {
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
