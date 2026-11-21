import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

import { ionIconSrc } from '../../shell/icons';
import { ionChange, mountPart, mountTable, type PartOptions, settle, text } from './__tests__/harness';
import { toolbarSource } from './__tests__/part-sources';
import DataTableToolbar from './DataTableToolbar.vue';
import { DATA_TABLE_ICONS } from './model';
import type { DataTableColumn } from './types';

const sync = vi.hoisted(() => vi.fn());
vi.mock('./searchbarName', () => ({ syncSearchbarInputName: sync }));

beforeEach(() => {
  sync.mockClear();
});

afterEach(() => {
  document.body.replaceChildren();
});

type Row = Record<string, unknown>;
type Ionic = HTMLElement & Record<string, unknown>;

const COLUMNS: DataTableColumn<Row>[] = [
  { key: 'name', label: 'Name' },
  { key: 'city', label: 'City' },
];

/** The toolbar row as the table paints it with nothing turned on: each test turns on what it reads. */
const AT_REST = {
  title: '',
  loadFailed: false,
  awaitingRows: false,
  count: 0,
  hasSearch: false,
  search: '',
  columns: COLUMNS,
  shownColumns: COLUMNS,
  columnPicker: false,
  isMobile: false,
  pageSizeSelectable: false,
  pageSize: 10,
  pageSizeOptions: [10, 25],
  viewToggle: false,
  viewMode: 'table',
  showFunnel: false,
  filterPanelOpen: false,
  filtering: false,
  refused: false,
  filterCount: 0,
  addable: false,
  testid: 'bills',
};

function mountToolbar(props: Record<string, unknown> = {}, options: PartOptions = {}) {
  return mountPart(DataTableToolbar, AT_REST, props, options);
}

type Toolbar = ReturnType<typeof mountToolbar>;
const el = (t: Toolbar, selector: string) => t.element.querySelector(selector) as Ionic | null;
const funnel = (t: Toolbar) => el(t, '.data-table__filter-button');
/** An ion-button hands a changed aria-* to its native button: that one first, then the host. */
const aria = (button: Element | null, name: string) => button?.shadowRoot?.querySelector('button')?.getAttribute(name) ?? button?.getAttribute(name);
/** Lets Vue render the new props and Ionic hand them to its native elements. */
async function change(t: Toolbar, props: Record<string, unknown>): Promise<void> {
  await t.setProps(props);
  await settle();
}
/** Ionic's `ionChange` / `ionInput` of one of its controls. */
function send(target: Element | null, event: 'ionChange' | 'ionInput', value: unknown): void {
  target?.dispatchEvent(new CustomEvent(event, { detail: { value } }));
}

describe('DataTableToolbar', () => {
  it('heads the row with its title and the records counted, never counted while the rows load or after a failed load', async () => {
    const t = mountToolbar({ title: 'Invoices', count: 56 });
    expect(t.element.className).toBe('data-table__bar-main');
    expect([text(el(t, 'h2.data-table__title')), text(el(t, '.data-table__title-count'))]).toEqual(['Invoices', '56']);
    await t.setProps({ awaitingRows: true });
    expect(el(t, '.data-table__title-count')).toBeNull();
    await t.setProps({ awaitingRows: false, loadFailed: true });
    expect(el(t, '.data-table__title-count')).toBeNull();
    await t.setProps({ title: '' });
    expect(el(t, '.data-table__title-wrap')).toBeNull();
  });

  it('the search box shows the query with «Search…» or the page’s own hint, and hands over what is typed', async () => {
    const t = mountToolbar({ hasSearch: true, search: 'lun' });
    const box = el(t, '.data-table__search > ion-searchbar');
    expect([box?.value, box?.placeholder, box?.debounce, box?.getAttribute('data-testid')]).toEqual(['lun', 'Search…', 250, 'bills-search']);
    await t.setProps({ searchPlaceholder: 'Search menus…' });
    expect(box?.placeholder).toBe('Search menus…');
    for (const typed of ['lunch', undefined]) {
      if (box) box.value = typed;
      send(box, 'ionInput', typed);
    }
    expect(t.emitted('search')).toEqual([['lunch'], ['']]);
    await t.setProps({ hasSearch: false });
    expect(el(t, 'ion-searchbar')).toBeNull();
  });

  it('the column chooser lists every column, marks the shown ones and hands over the keys picked; not on a phone, nor when turned off', async () => {
    const t = mountToolbar({ columnPicker: true, shownColumns: [COLUMNS[1]] });
    const chooser = el(t, ':scope > ion-select.data-table__columns-select');
    expect([chooser?.interface, chooser?.multiple, chooser?.selectedText, chooser?.getAttribute('aria-label')]).toEqual(['popover', true, 'Columns', 'Visible columns']);
    expect(chooser?.value).toEqual(['city']);
    expect([...(chooser?.querySelectorAll<Ionic>('ion-select-option') ?? [])].map((option) => [option.value, text(option)])).toEqual([['name', 'Name'], ['city', 'City']]);
    for (const value of [['name'], [7], 'name']) send(chooser, 'ionChange', value);
    expect(t.emitted('columns')).toEqual([[['name']], [['7']], [[]]]);
    await t.setProps({ isMobile: true });
    expect(el(t, '.data-table__columns-select')).toBeNull();
    await t.setProps({ isMobile: false, columnPicker: false });
    expect(el(t, '.data-table__columns-select')).toBeNull();
  });

  it('rows per page: the options, showing the page size, and the size picked handed over as a number; not on a phone', async () => {
    const t = mountToolbar({ pageSizeSelectable: true, pageSize: 25 });
    const select = el(t, ':scope > ion-select.data-table__page-size-select');
    expect([select?.interface, select?.value, select?.getAttribute('aria-label')]).toEqual(['popover', 25, 'Rows per page']);
    expect([...(select?.querySelectorAll<Ionic>('ion-select-option') ?? [])].map((option) => option.value)).toEqual([10, 25]);
    send(select, 'ionChange', '10');
    expect(t.emitted('pageSize')).toEqual([[10]]);
    await t.setProps({ isMobile: true });
    expect(el(t, '.data-table__page-size-select')).toBeNull();
    await t.setProps({ isMobile: false, pageSizeSelectable: false });
    expect(el(t, '.data-table__page-size-select')).toBeNull();
  });

  it('the list/cards switch marks the view on screen, names both buttons and hands over only a view', async () => {
    const t = mountToolbar({ viewToggle: true, viewMode: 'cards' });
    const segment = el(t, ':scope > ion-segment.data-table__view-segment');
    expect([segment?.value, segment?.getAttribute('data-testid')]).toEqual(['cards', 'bills-view']);
    const buttons = [...(segment?.querySelectorAll<Ionic>('ion-segment-button') ?? [])];
    expect(buttons.map((b) => [b.value, b.getAttribute('data-testid'), b.getAttribute('title'), b.getAttribute('aria-label')])).toEqual([
      ['table', 'bills-view-table', 'View as list', 'View as list'],
      ['cards', 'bills-view-cards', 'View as cards', 'View as cards'],
    ]);
    expect(buttons.map((b) => b.querySelector<Ionic>('ion-icon')?.icon)).toEqual([ionIconSrc(DATA_TABLE_ICONS.list), ionIconSrc(DATA_TABLE_ICONS.cards)]);
    for (const value of ['table', 'grid', 'cards']) send(segment, 'ionChange', value);
    expect(t.emitted('view')).toEqual([['table'], ['cards']]);
    await t.setProps({ viewToggle: false });
    expect(el(t, 'ion-segment')).toBeNull();
  });

  it('the funnel is outlined at rest, solid while filtering or open, and asks for the filters panel', async () => {
    const t = mountToolbar({ showFunnel: true });
    await settle();
    const at = () => [funnel(t)?.fill, aria(funnel(t), 'aria-label'), aria(funnel(t), 'aria-pressed'), text(el(t, '.data-table__filter-count'))];
    expect([funnel(t)?.getAttribute('title'), funnel(t)?.getAttribute('data-testid'), el(t, '.data-table__filter-button > ion-icon')?.icon]).toEqual(['Filters', 'bills-filters-toggle', ionIconSrc(DATA_TABLE_ICONS.filters)]);
    expect(at()).toEqual(['outline', 'Filters', 'false', '']);
    await change(t, { filtering: true, filterCount: 1 });
    expect(at()).toEqual(['solid', 'Filters (1 active)', 'false', '1']);
    expect(el(t, '.data-table__filter-count')?.getAttribute('data-testid')).toBe('bills-filters-count');
    await change(t, { filterCount: 3 });
    expect(at()).toEqual(['solid', 'Filters (3 active)', 'false', '3']);
    await change(t, { filtering: false, filterCount: 0, filterPanelOpen: true });
    expect(at()).toEqual(['solid', 'Filters', 'true', '']);
    funnel(t)?.click();
    expect(t.emitted('filters')).toEqual([[]]);
    await change(t, { showFunnel: false });
    expect(funnel(t)).toBeNull();
  });

  it('a refused filter turns the funnel red and names it «check the marked ones»', async () => {
    const t = mountToolbar({ showFunnel: true, filtering: true, filterCount: 2 });
    await settle();
    expect([funnel(t)?.color, funnel(t)?.hasAttribute('data-invalid')]).toEqual([undefined, false]);
    await change(t, { refused: true });
    expect([funnel(t)?.color, funnel(t)?.getAttribute('data-invalid'), aria(funnel(t), 'aria-label')]).toEqual(['danger', 'true', 'Filters (check the marked ones)']);
  });

  it('«Add» and the primary action are labelled buttons, with their own icon or the create one, that hand over a press', async () => {
    const t = mountToolbar({ addable: true, primaryAction: { label: 'Import', icon: 'download-outline' } });
    const [add, primary] = [...(t.element as HTMLElement).querySelectorAll<Ionic>(':scope > ion-button.data-table__primary-button.data-table__add-button')];
    const iconOf = (button: Ionic | null) => button?.querySelector<Ionic>('ion-icon[slot="start"]')?.icon;
    expect([text(add), add.getAttribute('data-testid'), add.size, iconOf(add)]).toEqual(['Add', 'bills-add', 'small', ionIconSrc(DATA_TABLE_ICONS.add)]);
    expect([text(primary), primary.getAttribute('data-testid'), primary.size, iconOf(primary)]).toEqual(['Import', 'bills-primary-action', 'small', ionIconSrc('download-outline')]);
    add.click();
    primary.click();
    expect([t.emitted('add'), t.emitted('primaryAction')]).toEqual([[[]], [[]]]);
    await t.setProps({ addable: false, primaryAction: { label: 'Export' } });
    expect([t.element.querySelectorAll('.data-table__add-button').length, iconOf(el(t, '.data-table__add-button'))]).toEqual([1, ionIconSrc(DATA_TABLE_ICONS.add)]);
  });

  it('the page’s own filters sit right after the search and its own tools at the end', () => {
    const t = mountToolbar(
      { hasSearch: true, columnPicker: true, addable: true },
      { slots: { filters: '<select class="own-filter"></select>', toolbar: '<button class="own-tool">Own</button>' } },
    );
    const known = ['data-table__search', 'own-filter', 'data-table__spacer', 'data-table__columns-select', 'data-table__add-button', 'own-tool'];
    expect([...t.element.children].map((child) => known.find((k) => child.classList.contains(k)))).toEqual(known);
  });

  it('names its search box after each render, after the hint in force, and its clear button with its own text', async () => {
    const t = mountToolbar({ hasSearch: true, searchPlaceholder: 'Search users…' });
    await nextTick();
    const last = () => sync.mock.calls.at(-1) as [Element, () => string, () => string];
    expect(last()[0]).toBe(t.element);
    expect([last()[1](), last()[2]()]).toEqual(['Search users…', 'Clear search']);
    const calls = sync.mock.calls.length;
    await t.setProps({ searchPlaceholder: undefined, labels: { clearSearch: 'Wipe the search' } });
    expect(sync.mock.calls.length).toBeGreaterThan(calls);
    expect([last()[1](), last()[2]()]).toEqual(['Search…', 'Wipe the search']);
  });

  it('speaks Spanish', () => {
    const t = mountToolbar(
      { hasSearch: true, columnPicker: true, pageSizeSelectable: true, viewToggle: true, showFunnel: true, filtering: true, filterCount: 2, addable: true },
      { locale: 'es' },
    );
    expect(el(t, 'ion-searchbar')?.placeholder).toBe('Buscar…');
    expect([el(t, '.data-table__columns-select')?.getAttribute('aria-label'), el(t, '.data-table__columns-select')?.selectedText]).toEqual(['Columnas visibles', 'Columnas']);
    expect(el(t, '.data-table__page-size-select')?.getAttribute('aria-label')).toBe('Filas por página');
    expect([...t.element.querySelectorAll('ion-segment-button')].map((b) => b.getAttribute('aria-label'))).toEqual(['Vista lista', 'Vista tarjetas']);
    expect([funnel(t)?.getAttribute('title'), aria(funnel(t), 'aria-label')]).toEqual(['Filtros', 'Filtros (2 activos)']);
    expect(text(el(t, '.data-table__add-button'))).toBe('Añadir');
  });
});

describe('DataTableToolbar inside the table', () => {
  it('boxes a select the page puts in its `filters` or `toolbar` slot: the select carries the slot scope of the row that styles it', async () => {
    const slots = { filters: '<ion-select class="own-filter"></ion-select>', toolbar: '<ion-select class="own-tool"></ion-select>' };
    const t = mountTable({ rows: [{ id: 1, name: 'Lunch' }], columns: COLUMNS, searchable: true }, { slots });
    await settle();
    expect(toolbarSource).toContain('.data-table__bar-main > :slotted(ion-select) {');
    const scope = `${(DataTableToolbar as { __scopeId?: string }).__scopeId}-s`;
    const boxed = ['own-filter', 'own-tool'].map((name) => t.element.querySelector(`.data-table__bar-main > ion-select.${name}`)?.hasAttribute(scope));
    expect(boxed).toEqual([true, true]);
  });

  it('sizes that select to the option it shows, so a long option («Todos los tipos») is never cut', () => {
    const rule = toolbarSource.match(/\.data-table__bar-main > :slotted\(ion-select\) \{([^}]*)\}/)?.[1] ?? '';
    const declared = (property: string) => rule.match(new RegExp(`(?:^|;)\\s*${property}:\\s*([^;]+);`))?.[1].trim();
    // Ionic's select fills its box (`width: 100%`): without its own width every filter came out exactly as wide as its cap.
    expect(declared('width')).toBe('auto');
    expect(Number.parseFloat(declared('max-width') ?? '0')).toBeGreaterThanOrEqual(16);
  });

  it('counts every record of the query next to the title, not only the page on screen', async () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: `Invoice ${i + 1}` }));
    const t = mountTable({ rows, columns: COLUMNS, title: 'Invoices', serverSide: true, total: 56 });
    await settle();
    expect(text(t.element.querySelector('.data-table__title-count'))).toBe('56');
  });

  it('offers the table’s own rows-per-page options and shows the size picked', async () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));
    const t = mountTable({ rows, columns: COLUMNS, pageSize: 5, pageSizeOptions: [5, 20] });
    await settle();
    const select = () => t.element.querySelector('.data-table__bar-main > .data-table__page-size-select') as Ionic;
    expect([...select().querySelectorAll<Ionic>('ion-select-option')].map((option) => option.value)).toEqual([5, 20]);
    await ionChange(select(), { value: 20 });
    expect(select().value).toBe(20);
  });
});
