import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mountFilterPart } from './__tests__/filter-part';
import { byTestId, click, ionChange, mountTable, settle, text, viewport } from './__tests__/harness';
import DataTableFilterRow from './DataTableFilterRow.vue';
import DataTableLookup from './DataTableLookup.vue';
import type { DataTableColumn, DataTableFilters, DataTableLabels } from './types';

beforeEach(() => {
  viewport(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

type Row = Record<string, unknown>;

/** One filtered column of each kind the row paints with Ionic's own controls. */
const FILTERED: DataTableColumn<Row>[] = [
  { key: 'status', label: 'Status', filter: { type: 'select', options: [{ value: 'open', label: 'Open' }] } },
  { key: 'total', label: 'Total', filter: { type: 'range' } },
  { key: 'issued', label: 'Issued', filter: { type: 'daterange' } },
  { key: 'day', label: 'Day', filter: { type: 'date' } },
  { key: 'customer', label: 'Customer', filter: { type: 'text', maxlength: 40 } },
];

interface RowState {
  columns: DataTableColumn<Row>[];
  applied: DataTableFilters;
  filtering: boolean;
  filterErrors?: Record<string, string>;
  labels?: Partial<DataTableLabels>;
}

/** The filter row as the table mounts it: the table's filter controls and the filters applied. */
function mountRow(state: Partial<RowState> = {}, locale: 'en' | 'es' = 'en') {
  const initial: RowState = { columns: FILTERED, applied: {}, filtering: false, ...state };
  const { wrapper, props } = mountFilterPart(
    DataTableFilterRow,
    initial,
    (s, controls) => ({ filterColumns: s.columns, applied: s.applied, controls, filtering: s.filtering, labels: s.labels, testid: 'bills' }),
    locale,
  );
  return { wrapper, props, row: () => wrapper.findComponent(DataTableFilterRow) };
}

type Mounted = ReturnType<typeof mountRow>;
type Control = HTMLElement & { value?: unknown; errorText?: string; selectedText?: string; placeholder?: string };
const control = (m: Mounted, name: string) => byTestId(m.wrapper, `bills-filter-${name}`)[0] as Control;
const chip = (m: Mounted) => byTestId(m.wrapper, 'bills-filters-clear')[0] as HTMLElement | undefined;
const group = (m: Mounted) => m.wrapper.element as HTMLElement;
/** Stencil's slot patch hides `textContent` of an ion-label under happy-dom, and a hydrated one starts with its comment. */
const chipText = (el: HTMLElement | undefined) => el?.querySelector('ion-label')?.innerHTML.replace(/<!---->/g, '').trim();
function send(el: HTMLElement, event: 'ionInput' | 'ionChange', value: unknown): void {
  el.dispatchEvent(new CustomEvent(event, { detail: { value } }));
}

describe('DataTableFilterRow', () => {
  it('is a group named «Filters», one control per filtered column in order, on the filters applied', async () => {
    const m = mountRow({ applied: { status: 'open', customer: 'Ana' } });
    await settle();
    expect([group(m).className, group(m).getAttribute('role'), group(m).getAttribute('aria-label')]).toEqual(['data-table__filters', 'group', 'Filters']);
    expect(group(m).getAttribute('data-testid')).toBe('bills-filters');
    const names = [...group(m).querySelectorAll('[data-testid^="bills-filter-"]')].map((el) => el.getAttribute('data-testid'));
    expect(names).toEqual(['status', 'total_from', 'total_to', 'issued_from', 'issued_to', 'day', 'customer'].map((name) => `bills-filter-${name}`));
    expect([control(m, 'status').value, control(m, 'customer').value, control(m, 'day').value]).toEqual(['open', 'Ana', '']);
    m.props.applied = {};
    await settle();
    expect(control(m, 'status').selectedText, 'unfiltered, the select reads as its column').toBe('Status');
  });

  it('hands every change over at once, by name and as text, each control on its own event', async () => {
    const m = mountRow();
    await settle();
    send(control(m, 'status'), 'ionChange', 'open');
    send(control(m, 'total_to'), 'ionInput', 10);
    send(control(m, 'total_to'), 'ionChange', 11);
    send(control(m, 'issued_from'), 'ionInput', '2026-10');
    send(control(m, 'issued_from'), 'ionChange', '2026-10-01');
    send(control(m, 'day'), 'ionChange', null);
    send(control(m, 'customer'), 'ionInput', 'Ana');
    expect(m.row().emitted('filter')).toEqual([['status', 'open'], ['total_to', '10'], ['issued_from', '2026-10-01'], ['day', ''], ['customer', 'Ana']]);
  });

  it('«Clear filters» is there only while some filter filters, and asks to lift them on a click, Enter or Space', async () => {
    const m = mountRow();
    await settle();
    expect(chip(m)).toBeUndefined();
    m.props.filtering = true;
    await settle();
    await click(chip(m));
    for (const key of ['Enter', ' ']) {
      const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      chip(m)?.dispatchEvent(ev);
      expect([key, ev.defaultPrevented]).toEqual([key, true]);
    }
    expect(m.row().emitted('clear')).toEqual([[], [], []]);
  });

  it('what the server refused sits under its control until its value changes', async () => {
    const m = mountRow({ applied: { total_from: 'x' }, filterErrors: { total_from: 'Not a number.' } });
    await settle();
    expect([control(m, 'total_from').errorText, control(m, 'total_from').classList.contains('ion-invalid')]).toEqual(['Not a number.', true]);
    expect(control(m, 'total_to').classList.contains('ion-invalid')).toBe(false);
    send(control(m, 'total_from'), 'ionInput', '3');
    await settle();
    expect(control(m, 'total_from').errorText).toBeFalsy();
    expect(m.row().emitted('filter')).toEqual([['total_from', '3']]);
  });

  it('a lookup is handed over at once with the label it was picked with, answers what the server refused and reads the table’s texts', async () => {
    const columns: DataTableColumn<Row>[] = [{ key: 'user_id', label: 'Employee', filter: { type: 'lookup', load: async () => [] } }];
    const labels = { lookupEmpty: 'Nobody' };
    const m = mountRow({ columns, applied: { user_id: '4' }, filterErrors: { user_id: 'Unknown employee.' }, labels });
    await settle();
    const lookup = () => m.wrapper.findComponent(DataTableLookup);
    expect([lookup().props('errorText'), lookup().props('labels'), lookup().props('testid')]).toEqual(['Unknown employee.', labels, 'bills-filter-user_id']);
    lookup().vm.$emit('change', '7', 'Luis');
    expect(m.row().emitted('filter')).toEqual([['user_id', '7']]);
    m.props.applied = { user_id: '7' };
    await settle();
    expect([lookup().props('value'), lookup().props('display'), lookup().props('errorText')]).toEqual(['7', 'Luis', undefined]);
  });

  it('speaks Spanish: «Filtros», «Todos», «Desde» / «Hasta» and «Limpiar filtros»', async () => {
    const m = mountRow({ filtering: true }, 'es');
    await settle();
    expect(group(m).getAttribute('aria-label')).toBe('Filtros');
    expect(text(control(m, 'status').querySelector('ion-select-option'))).toBe('Todos');
    expect([control(m, 'total_from').placeholder, control(m, 'total_to').placeholder]).toEqual(['Desde', 'Hasta']);
    expect(chipText(chip(m))).toBe('Limpiar filtros');
  });
});

describe('DataTableFilterRow inside the table', () => {
  const table = (props: Record<string, unknown>) =>
    mountTable({ rows: [{ id: '1', status: 'open' }], columns: FILTERED, testid: 'bills', views: true, ...props }, { attachTo: document.body });
  const funnel = (t: ReturnType<typeof table>) => byTestId(t, 'bills-filters-toggle')[0] as HTMLElement & { color?: string };

  it('shares the table’s one state of its filter controls: an error answered in the row stays answered behind the funnel', async () => {
    const t = table({ filters: { status: 'gone' }, filterErrors: { status: 'Unknown status.' } });
    await settle();
    send(byTestId(t, 'bills-filter-status')[0], 'ionChange', 'open');
    await settle();
    await ionChange(t.element.querySelector('.data-table__view-segment') as HTMLElement, { value: 'cards' });
    expect([funnel(t).color ?? null, funnel(t).hasAttribute('data-invalid')]).toEqual([null, false]);
  });

  it('names its group and «Clear filters» with the table’s own `labels`', async () => {
    const t = table({ filters: { status: 'open' }, labels: { filters: 'Narrow down', clearFilters: 'Show everything' } });
    await settle();
    expect(byTestId(t, 'bills-filters')[0].getAttribute('aria-label')).toBe('Narrow down');
    expect(chipText(byTestId(t, 'bills-filters-clear')[0])).toBe('Show everything');
  });
});
