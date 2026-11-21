import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { mountFilterPart } from './__tests__/filter-part';
import { byTestId, click, mountTable, settle, text } from './__tests__/harness';
import { pagerSource, panelSource, rowSource, tableSource, toolbarSource } from './__tests__/part-sources';
import DataTableFilterPanel from './DataTableFilterPanel.vue';
import DataTableLookup from './DataTableLookup.vue';
import type { DataTableColumn, DataTableFilters, DataTableLabels } from './types';

afterEach(() => {
  document.body.replaceChildren();
});

type Row = Record<string, unknown>;

const COLUMNS: DataTableColumn<Row>[] = [
  { key: 'name', label: 'Name', filter: { type: 'text' } },
  { key: 'status', label: 'Status', filter: { type: 'select', options: [{ value: 'active', label: 'Active' }] } },
  { key: 'rate', label: 'Rate', filter: { type: 'range' } },
  { key: 'day', label: 'Day', filter: { type: 'date' } },
];

interface PanelState {
  columns: DataTableColumn<Row>[];
  applied: DataTableFilters;
  filtering: boolean;
  sheet: boolean;
  filterErrors?: Record<string, string>;
  labels?: Partial<DataTableLabels>;
}

/** The panel as the table mounts it: the table's filter controls, the applied filters and the sheet. */
function mountPanel(state: Partial<PanelState> = {}, locale: 'en' | 'es' = 'en') {
  const initial: PanelState = { columns: COLUMNS, applied: {}, filtering: false, sheet: false, ...state };
  const { wrapper, props } = mountFilterPart(
    DataTableFilterPanel,
    initial,
    (s, controls) => ({
      filterColumns: s.columns,
      applied: s.applied,
      controls,
      filtering: s.filtering,
      sheet: s.sheet,
      labels: s.labels,
      testid: 'rules',
    }),
    locale,
  );
  return { wrapper, props, panel: () => wrapper.findComponent(DataTableFilterPanel) };
}

type Mounted = ReturnType<typeof mountPanel>;
const control = (m: Mounted, name: string) => byTestId(m.wrapper, `rules-filter-${name}`)[0] as HTMLElement & { value?: unknown; errorText?: string };
const button = (m: Mounted, name: string) => byTestId(m.wrapper, `rules-filters-${name}`)[0] as HTMLElement & { disabled?: boolean };
const dialog = (m: Mounted) => m.wrapper.element as HTMLElement;
/** Once loaded, Ionic moves an ARIA attribute from the host onto its native element. */
const aria = (el: HTMLElement, name: string) => el.getAttribute(name) ?? (el.shadowRoot ?? el).querySelector(`[${name}]`)?.getAttribute(name) ?? null;
function edit(el: HTMLElement, event: 'ionInput' | 'ionChange', value: unknown): void {
  el.dispatchEvent(new CustomEvent(event, { detail: { value } }));
}
function key(el: HTMLElement, name: string, used = false): KeyboardEvent {
  const ev = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true });
  if (used) ev.preventDefault();
  el.dispatchEvent(ev);
  return ev;
}

/** Selectors of the rules in a stylesheet (comments out). */
const selectors = (css: string) => [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{[^{}]*\}/g)].map((m) => m[1].trim());
const ownStyle = (source: string) => source.match(/<style scoped>([\s\S]*?)<\/style>/)?.[1] ?? '';
const CONTROLS_CSS = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'controls.css'), 'utf8');

describe('DataTableFilterPanel', () => {
  it('is a dialog named by its title, one labelled control per filtered column in order, on the filters applied', async () => {
    const m = mountPanel({ applied: { status: 'active', unknown: 'x' } });
    await settle();
    expect([dialog(m).localName, dialog(m).className, dialog(m).getAttribute('role')]).toEqual(['aside', 'data-table__drawer', 'dialog']);
    expect(text(document.getElementById(dialog(m).getAttribute('aria-labelledby') ?? ''))).toBe('Filters');
    const names = [...dialog(m).querySelectorAll('[data-testid^="rules-filter-"]')].map((el) => el.getAttribute('data-testid'));
    expect(names).toEqual(['rules-filter-name', 'rules-filter-status', 'rules-filter-rate_from', 'rules-filter-rate_to', 'rules-filter-day']);
    expect([control(m, 'status').value, control(m, 'name').value]).toEqual(['active', '']);
    expect(dialog(m).hasAttribute('aria-modal')).toBe(false);
  });

  it('edits a draft, every change kept even in one tick: «Apply» hands it over and nothing is applied before', async () => {
    const m = mountPanel();
    await settle();
    edit(control(m, 'status'), 'ionChange', 'active');
    edit(control(m, 'rate_to'), 'ionInput', 10);
    edit(control(m, 'day'), 'ionChange', null);
    expect(m.panel().emitted()).toEqual({});
    await click(button(m, 'apply'));
    expect(m.panel().emitted('apply')).toEqual([[{ status: 'active', rate_to: '10', day: '' }]]);
  });

  it('«Clear» empties the draft and asks to lift what is applied; with nothing applied or written it is disabled', async () => {
    const m = mountPanel({ applied: { status: 'active' }, filtering: true });
    await settle();
    expect(button(m, 'clear').disabled).toBe(false);
    await click(button(m, 'clear'));
    expect(m.panel().emitted('clear')).toEqual([[]]);
    expect(control(m, 'status').value).toBe('');
    expect(button(m, 'clear').disabled, 'until the table lifts it, a filter is still applied').toBe(false);
    m.props.filtering = false;
    await settle();
    expect(button(m, 'clear').disabled).toBe(true);
    edit(control(m, 'name'), 'ionInput', 'ana');
    await settle();
    expect(button(m, 'clear').disabled).toBe(false);
  });

  it('follows the filters applied while it is open', async () => {
    const m = mountPanel({ applied: { status: 'active' } });
    await settle();
    edit(control(m, 'name'), 'ionInput', 'ana');
    m.props.applied = { day: '2026-10-14' };
    await settle();
    expect([control(m, 'status').value, control(m, 'name').value, control(m, 'day').value]).toEqual(['', '', '2026-10-14']);
  });

  it('Close and Escape ask to close; an Escape a control inside already used does not', async () => {
    const m = mountPanel();
    await settle();
    await click(button(m, 'close'));
    expect(key(control(m, 'status'), 'Escape', true).defaultPrevented).toBe(true);
    expect(m.panel().emitted('close')).toEqual([[]]);
    expect(key(dialog(m), 'Escape').defaultPrevented).toBe(true);
    expect(m.panel().emitted('close')).toEqual([[], []]);
  });

  it('a sheet is modal and keeps Tab inside it; beside the list Tab leaves it', async () => {
    const m = mountPanel({ sheet: true });
    await settle();
    expect(dialog(m).getAttribute('aria-modal')).toBe('true');
    const apply = button(m, 'apply');
    (apply.shadowRoot?.querySelector('button') ?? apply).focus();
    expect(key(apply, 'Tab').defaultPrevented).toBe(true);
    expect(document.activeElement === button(m, 'close'), 'Tab on «Apply» goes back to «Close»').toBe(true);
    m.props.sheet = false;
    await settle();
    expect(dialog(m).hasAttribute('aria-modal')).toBe(false);
    expect(key(apply, 'Tab').defaultPrevented).toBe(false);
  });

  it('what the server refused sits under its control until its value changes', async () => {
    const m = mountPanel({ applied: { status: 'gone' }, filterErrors: { status: 'Unknown status.' } });
    await settle();
    expect(control(m, 'status').errorText).toBe('Unknown status.');
    expect(control(m, 'status').classList.contains('ion-invalid')).toBe(true);
    edit(control(m, 'status'), 'ionChange', 'active');
    await settle();
    expect(control(m, 'status').errorText).toBeFalsy();
  });

  it('a lookup goes into the draft with the label it was picked with, answers what the server refused and reads the table’s texts', async () => {
    const columns: DataTableColumn<Row>[] = [{ key: 'user_id', label: 'Employee', filter: { type: 'lookup', load: async () => [] } }];
    const labels = { lookupEmpty: 'Nobody' };
    const m = mountPanel({ columns, applied: { user_id: '4' }, filterErrors: { user_id: 'Unknown employee.' }, labels });
    await settle();
    const lookup = () => m.wrapper.findComponent(DataTableLookup);
    expect([lookup().props('errorText'), lookup().props('labels')]).toEqual(['Unknown employee.', labels]);
    lookup().vm.$emit('change', '7', 'Luis');
    await settle();
    expect([lookup().props('value'), lookup().props('display'), lookup().props('errorText')]).toEqual(['7', 'Luis', undefined]);
    await click(button(m, 'apply'));
    expect(m.panel().emitted('apply')).toEqual([[{ user_id: '7' }]]);
  });

  it('speaks Spanish: «Filtros», «Todos», «Desde» / «Hasta», «Limpiar», «Aplicar» and «Cerrar»', async () => {
    const m = mountPanel({}, 'es');
    await settle();
    expect(text(document.getElementById(dialog(m).getAttribute('aria-labelledby') ?? ''))).toBe('Filtros');
    expect(text(control(m, 'status').querySelector('ion-select-option'))).toBe('Todos');
    expect([control(m, 'rate_from'), control(m, 'rate_to')].map((el) => (el as HTMLElement & { placeholder?: string }).placeholder)).toEqual(['Desde', 'Hasta']);
    expect([text(button(m, 'clear')), text(button(m, 'apply')), aria(button(m, 'close'), 'aria-label')]).toEqual(['Limpiar', 'Aplicar', 'Cerrar']);
  });

  it('its controls take the table’s shell shield from the sheet the parts share, as the table and its footer do: none repeats it', () => {
    const shared = selectors(CONTROLS_CSS);
    expect(shared).toEqual(expect.arrayContaining(['*', ':where(.data-table) ion-button', ':where(.data-table) ion-select', '.data-table__primary-button']));
    for (const [name, source] of [['DataTable.vue', tableSource], ['DataTablePager.vue', pagerSource], ['DataTableFilterPanel.vue', panelSource], ['DataTableFilterRow.vue', rowSource], ['DataTableToolbar.vue', toolbarSource]]) {
      expect([name, source.includes('<style scoped src="./controls.css"></style>')]).toEqual([name, true]);
      expect([name, selectors(ownStyle(source)).filter((selector) => shared.includes(selector))]).toEqual([name, []]);
    }
  });
});

describe('DataTableFilterPanel inside the table', () => {
  const table = (props: Record<string, unknown>) =>
    mountTable({ rows: [{ id: '1', name: 'Ana' }], columns: COLUMNS, testid: 'rules', filterable: true, ...props }, { attachTo: document.body });
  const funnel = (t: ReturnType<typeof table>) => byTestId(t, 'rules-filters-toggle')[0] as HTMLElement & { color?: string };

  it('shares the table’s one state of its filter controls: an error answered in the panel lifts the funnel’s warning', async () => {
    const t = table({ filters: { status: 'gone' }, filterErrors: { status: 'Unknown status.' } });
    await settle();
    expect(funnel(t).color).toBe('danger');
    await click(funnel(t));
    edit(byTestId(t, 'rules-filter-status')[0], 'ionChange', 'active');
    await settle();
    expect([funnel(t).color ?? null, funnel(t).hasAttribute('data-invalid')]).toEqual([null, false]);
  });

  it('says the table’s own `labels`', async () => {
    const t = table({ labels: { filters: 'Narrow down', apply: 'Show results' } });
    await settle();
    await click(funnel(t));
    const panel = byTestId(t, 'rules-filters-panel')[0];
    expect(text(document.getElementById(panel.getAttribute('aria-labelledby') ?? ''))).toBe('Narrow down');
    expect(text(byTestId(t, 'rules-filters-apply')[0])).toBe('Show results');
  });
});
