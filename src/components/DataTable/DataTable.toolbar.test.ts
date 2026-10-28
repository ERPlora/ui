// DataTable toolbar: fixed order (search · filters slot · spacer · selectors · buttons · own slot), the create
// button that says what it adds (#113, #216), the primary action, the title with its count, the
// column chooser, and the search box's accessible name (#182). Cases ported from the Lit tests.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { click, ionChange, mountTable, settle, text, type, viewport } from './__tests__/harness';

const sync = vi.hoisted(() => vi.fn());
vi.mock('./searchbarName', () => ({ syncSearchbarInputName: sync }));

beforeEach(() => {
  viewport(false);
  sync.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

const NAME = [{ key: 'name', label: 'Name' }];
const ROWS = [{ id: 1, name: 'Lunch' }];
const addButton = (t: ReturnType<typeof mountTable>) => t.element.querySelector('.data-table__bar-main .data-table__add-button') as HTMLElement | null;
/** An ion-button's accessible name is its text unless an aria-label says otherwise. */
const accessibleName = (el: HTMLElement | null) => el?.getAttribute('aria-label') ?? text(el);

describe('the toolbar order is fixed (search first, buttons last)', () => {
  it('search · spacer · columns · rows per page · view segment · add · primary · own slot', async () => {
    const t = mountTable(
      { rows: ROWS, columns: NAME, searchable: true, views: true, addable: true, primaryAction: { label: 'Import', icon: 'download-outline' } },
      { slots: { toolbar: '<button class="own-tool">Own</button>' } },
    );
    await settle();
    const known = [
      'data-table__search',
      'data-table__spacer',
      'data-table__columns-select',
      'data-table__page-size-select',
      'data-table__view-segment',
      'data-table__primary-button',
      'own-tool',
    ];
    const order = [...t.element.querySelector('.data-table__bar-main')!.children].map((el) => known.find((k) => el.classList.contains(k)));
    expect(order).toEqual([
      'data-table__search',
      'data-table__spacer',
      'data-table__columns-select',
      'data-table__page-size-select',
      'data-table__view-segment',
      'data-table__primary-button',
      'data-table__primary-button',
      'own-tool',
    ]);
  });

  it('the page’s filters sit right after the search (Odoo, Shopify), before the spacer and the table’s own controls', async () => {
    const t = mountTable(
      { rows: ROWS, columns: NAME, searchable: true, addable: true },
      { slots: { filters: '<select class="own-filter"></select>', toolbar: '<button class="own-tool">Own</button>' } },
    );
    await settle();
    const known = ['data-table__search', 'own-filter', 'data-table__spacer', 'data-table__add-button', 'own-tool'];
    const order = [...t.element.querySelector('.data-table__bar-main')!.children]
      .map((el) => known.find((k) => el.classList.contains(k)))
      .filter(Boolean);
    expect(order).toEqual(['data-table__search', 'own-filter', 'data-table__spacer', 'data-table__add-button', 'own-tool']);
  });

  it('no toolbar when nothing asks for one; a `toolbar` slot alone is enough', async () => {
    const bare = mountTable({ rows: ROWS, columns: NAME, columnPicker: false, pageSizeOptions: [] });
    const slotted = mountTable({ rows: ROWS, columns: NAME, columnPicker: false }, { slots: { toolbar: '<span class="mine" />' } });
    await settle();
    expect(bare.find('.data-table__bar').exists()).toBe(false);
    expect(slotted.find('.data-table__bar .mine').exists()).toBe(true);
    const filters = mountTable({ rows: ROWS, columns: NAME, columnPicker: false, pageSizeOptions: [] }, { slots: { filters: '<span class="mine" />' } });
    await settle();
    expect(filters.find('.data-table__bar .mine').exists(), 'a `filters` slot alone is enough too').toBe(true);
  });
});

describe('the title, with the record count', () => {
  it('is a level-2 heading next to its count', async () => {
    const t = mountTable({ rows: [...ROWS, { id: 2, name: 'Dinner' }], columns: NAME, title: 'Menus' });
    await settle();
    expect(t.find('h2.data-table__title').text()).toBe('Menus');
    expect(t.find('.data-table__title-count').text()).toBe('2');
  });
});

describe('the create button says what it adds (#113, #216)', () => {
  for (const mobile of [false, true]) {
    const vp = mobile ? 'phone' : 'desk';
    it(`${vp}: a labelled primary button (not an anonymous «+»), named by \`labels.add\``, async () => {
      viewport(mobile);
      const t = mountTable({ rows: ROWS, columns: NAME, addable: true, labels: { add: 'Add time slot' } });
      const other = mountTable({ rows: ROWS, columns: NAME, addable: true, labels: { add: 'Block date' } });
      await settle();
      expect(text(addButton(t))).toBe('Add time slot');
      expect(accessibleName(addButton(t))).toBe('Add time slot');
      expect(accessibleName(addButton(other)), 'the label leaked from one table to the other').toBe('Block date');
      expect(addButton(t)?.classList.contains('data-table__primary-button')).toBe(true);
      expect(addButton(t)?.querySelector('ion-icon[slot="start"]')).not.toBeNull();
    });
  }

  it('keeps the locale default (en «Add», es «Añadir»), and follows a change of `labels`', async () => {
    const en = mountTable({ rows: ROWS, columns: NAME, addable: true });
    const es = mountTable({ rows: ROWS, columns: NAME, addable: true }, { locale: 'es' });
    await settle();
    expect(text(addButton(en))).toBe('Add');
    expect(text(addButton(es))).toBe('Añadir');
    await en.setProps({ labels: { add: 'Añadir franja' } });
    await settle();
    expect(text(addButton(en))).toBe('Añadir franja');
  });

  it('emits `add` (the page opens its own form); `labels.add` renames nothing else', async () => {
    const t = mountTable({ rows: [], columns: NAME, addable: true, labels: { add: 'Add time slot' } });
    await settle();
    await click(addButton(t));
    expect(t.emitted('add')).toHaveLength(1);
    expect(t.text()).toContain('No results');
  });
});

describe('the primary action', () => {
  it('shows its label and icon, shares the create button’s look, and emits `primaryAction`', async () => {
    const t = mountTable({ rows: ROWS, columns: NAME, primaryAction: { label: 'New order' } });
    await settle();
    const btn = t.element.querySelector('.data-table__bar-main .data-table__primary-button') as HTMLElement;
    expect(text(btn)).toBe('New order');
    expect(btn.classList.contains('data-table__add-button')).toBe(true);
    expect((btn.querySelector('ion-icon') as HTMLElement & { icon?: string }).icon).toContain('svg');
    await click(btn);
    expect(t.emitted('primaryAction')).toHaveLength(1);
  });
});

describe('the two toolbar selects are there BY DEFAULT on a desk, as in the Lit toolbar', () => {
  it('with nothing but rows and columns: «Columns» chooser, then rows per page showing 10, after the spacer', async () => {
    const t = mountTable({ rows: ROWS, columns: [...NAME, { key: 'city', label: 'City' }] });
    await settle();
    const bar = t.element.querySelector('.data-table__bar-main') as HTMLElement;
    const columns = bar.querySelector(':scope > .data-table__columns-select') as HTMLElement & Record<string, unknown>;
    const pageSize = bar.querySelector(':scope > .data-table__page-size-select') as HTMLElement & Record<string, unknown>;
    expect(columns, 'the column chooser is not painted').not.toBeNull();
    expect(pageSize, 'the rows-per-page select is not painted').not.toBeNull();
    // Same element, text and position as the Lit `.tk-cols` / `.tk-psize`.
    expect(columns.tagName).toBe('ION-SELECT');
    expect([columns.interface, columns.multiple, columns.selectedText]).toEqual(['popover', true, 'Columns']);
    expect(columns.getAttribute('aria-label')).toBe('Visible columns');
    expect(columns.value).toEqual(['name', 'city']);
    expect(pageSize.tagName).toBe('ION-SELECT');
    expect([pageSize.interface, pageSize.value]).toEqual(['popover', 10]);
    expect(pageSize.getAttribute('aria-label')).toBe('Rows per page');
    expect([...pageSize.querySelectorAll('ion-select-option')].map((o) => (o as HTMLElement & { value?: unknown }).value)).toEqual([10, 25, 50, 100]);
    const order = [...bar.children];
    const spacer = bar.querySelector(':scope > .data-table__spacer') as Element;
    expect(order.indexOf(spacer)).toBeLessThan(order.indexOf(columns));
    expect(order.indexOf(columns)).toBeLessThan(order.indexOf(pageSize));
  });

  it('a page size outside the options shows no value — exactly what the Lit select does', async () => {
    const t = mountTable({ rows: ROWS, columns: NAME, pageSize: 5 });
    await settle();
    const pageSize = t.element.querySelector('.data-table__page-size-select') as HTMLElement & { value?: unknown };
    expect(pageSize.value).toBe(5);
    expect([...pageSize.querySelectorAll('ion-select-option')].map((o) => (o as HTMLElement & { value?: unknown }).value)).not.toContain(5);
  });
});

describe('the column chooser (on by default)', () => {
  it('lists every column, shows the visible ones, says «Columns», and hides what is unpicked', async () => {
    const t = mountTable({ rows: ROWS, columns: [...NAME, { key: 'city', label: 'City' }] }, { locale: 'es' });
    await settle();
    const select = t.find('.data-table__columns-select');
    expect(select.attributes('aria-label')).toBe('Columnas visibles');
    expect((select.element as HTMLElement & { selectedText?: string }).selectedText).toBe('Columnas');
    expect((select.element as HTMLElement & { multiple?: boolean }).multiple).toBe(true);
    expect((select.element as HTMLElement & { value?: unknown }).value).toEqual(['name', 'city']);
    expect(select.findAll('ion-select-option').map((o) => o.text())).toEqual(['Name', 'City']);
    await ionChange(select.element, { value: ['city'] });
    expect(t.findAll('[role="columnheader"]').map((h) => h.text())).toEqual(['City']);
  });

  it('`columnPicker: false` removes it', async () => {
    const t = mountTable({ rows: ROWS, columns: NAME, columnPicker: false, searchable: true });
    await settle();
    expect(t.find('.data-table__columns-select').exists()).toBe(false);
  });
});

describe('the search box is named after its hint (#182)', () => {
  it('names it after each render, with the placeholder in force', async () => {
    const t = mountTable({ rows: ROWS, columns: NAME, searchable: true, searchPlaceholder: 'Search users…' });
    await settle();
    expect(sync).toHaveBeenCalled();
    const [root, name] = sync.mock.calls.at(-1) as [Element, () => string];
    expect(root.querySelector('ion-searchbar')).not.toBeNull();
    expect(name()).toBe('Search users…');
    await t.setProps({ searchPlaceholder: undefined });
    await settle();
    expect((sync.mock.calls.at(-1) as [Element, () => string])[1]()).toBe('Search…');
  });

  it('names its clear button with its own text (en «Clear search», es «Borrar búsqueda»), which `labels.clearSearch` rewords', async () => {
    const clearOf = () => (sync.mock.calls.at(-1) as [Element, () => string, (() => string)?])[2]?.();
    const t = mountTable({ rows: ROWS, columns: NAME, searchable: true });
    await settle();
    expect(clearOf()).toBe('Clear search');
    await t.setProps({ labels: { clearSearch: 'Wipe the search' } });
    await settle();
    expect(clearOf()).toBe('Wipe the search');
    const es = mountTable({ rows: ROWS, columns: NAME, searchable: true }, { locale: 'es' });
    await settle();
    expect(clearOf()).toBe('Borrar búsqueda');
    es.unmount();
  });
});

describe('`hideToolbarWhenEmpty`: an empty list paints only its empty state (mockups/saas-panel §6.16)', () => {
  const props = { columns: NAME, searchable: true, addable: true, title: 'Businesses', hideToolbarWhenEmpty: true };

  it('no record at all: neither toolbar nor footer, only the empty state (its slot offers the create action)', async () => {
    const t = mountTable({ ...props, rows: [] }, { slots: { empty: '<button class="create-first">Create your first business</button>' } });
    await settle();
    expect(t.find('.data-table__bar').exists()).toBe(false);
    expect(t.find('.data-table__pager').exists()).toBe(false);
    expect(t.find('.data-table__empty .create-first').exists()).toBe(true);
  });

  it('the first record brings the toolbar and the footer back', async () => {
    const t = mountTable({ ...props, rows: [] });
    await settle();
    await t.setProps({ rows: ROWS });
    await settle();
    expect(t.find('.data-table__bar').exists()).toBe(true);
    expect(t.find('.data-table__pager').exists()).toBe(true);
  });

  it('keeps the toolbar while the first rows load and when the load fails', async () => {
    const loading = mountTable({ ...props, rows: [], loading: true });
    const failed = mountTable({ ...props, rows: [], error: 'Network down' });
    await settle();
    expect(loading.find('.data-table__bar').exists()).toBe(true);
    expect(failed.find('.data-table__bar').exists()).toBe(true);
  });

  it('keeps the toolbar when a search finds nothing: the search box is how the person gets back (client and server)', async () => {
    const client = mountTable({ ...props, rows: ROWS, searchKeys: ['name'] });
    const server = mountTable({ ...props, serverSide: true, rows: [], total: 0, search: 'zzz' });
    await settle();
    await type(client, 'zzz');
    expect(client.find('.data-table__bar').exists()).toBe(true);
    expect(server.find('.data-table__bar').exists()).toBe(true);
  });

  it('off by default: an empty list keeps its toolbar', async () => {
    const t = mountTable({ ...props, hideToolbarWhenEmpty: undefined, rows: [] });
    await settle();
    expect(t.find('.data-table__bar').exists()).toBe(true);
  });
});
