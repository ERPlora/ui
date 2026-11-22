import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { base, change, control, ids, typeIn } from './__tests__/filter-table';
import { byTestId, cards, click, crossBreakpoint, dataRows, ionChange, mountTable, settle, text, viewport } from './__tests__/harness';

beforeEach(() => {
  viewport(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

// An open row of filter controls under the toolbar would take half a phone before the first card, so
// whenever the table paints cards the column filters behave as with `filterable`.
describe('in the card view the column filters fold behind the funnel', () => {
  const funnel = (t: ReturnType<typeof mountTable>) => byTestId(t, 'rules-filters-toggle')[0] as HTMLElement | undefined;
  const panel = (t: ReturnType<typeof mountTable>) => byTestId(t, 'rules-filters-panel')[0] as HTMLElement | undefined;
  const count = (t: ReturnType<typeof mountTable>) => byTestId(t, 'rules-filters-count')[0] as HTMLElement | undefined;
  const filterRow = (t: ReturnType<typeof mountTable>) => byTestId(t, 'rules-filters');
  const cardIds = (t: ReturnType<typeof mountTable>) => cards(t).map((c) => c.getAttribute('data-id'));
  const pick = (t: ReturnType<typeof mountTable>, view: 'table' | 'cards') =>
    ionChange(t.element.querySelector('.data-table__view-segment') as HTMLElement, { value: view });

  it('cards by default, without `filterable`: no filter row, a funnel whose panel filters the cards and closes on «Apply»', async () => {
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

  it('on a phone (cards forced by `cardBreakpoint`) the funnel opens the modal sheet', async () => {
    viewport(true);
    const t = mountTable({ ...base, views: true }, { attachTo: document.body });
    await settle();
    expect(cards(t)).toHaveLength(3);
    expect(filterRow(t)).toHaveLength(0);
    await click(funnel(t));
    expect(panel(t)?.getAttribute('aria-modal')).toBe('true');
  });

  it('the table view, wide, without `filterable`: the filter row stays open and there is no funnel', async () => {
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

  it('`filterable` stays behind the funnel in both views', async () => {
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

  it('without `filterable` the column filters keep their row and there is no funnel', async () => {
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
    expect((control(t, 'day') as HTMLElement & { readonly?: boolean }).readonly, 'a day is picked in the calendar, never typed').toBe(true);
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

  it('server mode with filters from outside (the address) paints them on the funnel and in the panel', async () => {
    const t = mountTable({ ...panelBase, serverSide: true, total: 3, pageSizeOptions: [10], filters: { status: 'active', rate_from: '5', day: '2026-10-14' } });
    await settle();
    expect(text(count(t))).toBe('3');
    await openPanel(t);
    expect(control(t, 'status').value).toBe('active');
    expect(control(t, 'rate_from').value).toBe('5');
    expect(control(t, 'day').value).toBe('10/14/2026');
    expect(control(t, 'name').value).toBe('');
    await typeIn(control(t, 'rate_from'), '');
    await click(byTestId(t, 'rules-filters-apply')[0]);
    expect(t.emitted('filtersChange')).toEqual([[{ status: 'active', day: '2026-10-14' }]]);
    expect(ids(t)).toEqual(['1', '2', '3']);
    expect(text(count(t))).toBe('2');
  });

  it('a name no column declares (a stale address parameter) is never sent nor counted', async () => {
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

  it('while open, the table publishes where the content area begins and ends (the phone sheet’s insets)', async () => {
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
