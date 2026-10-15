// DataTableLookup — the `lookup` column filter (FIX-DATATABLE, the Hub's SearchSelect filters: staff, roles,
// accounts…): one choice among more than a list can hold, inside the table's filters panel (no dialog of its
// own). The current choice is named (with a clear button); a search box asks the page's `load` for what is
// typed (the first matches on focus) and lists them; loading, empty and failed answers are said, a failure
// with «Retry»; the server's refusal (`filterErrors`) is painted under the field. The search box is an ARIA
// combobox over a listbox (WAI-ARIA APG): arrows move the active option, Enter picks it, Escape folds the list.
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createShellI18n } from '../../shell/i18n';
import DataTableLookup from './DataTableLookup.vue';
import type { DataTableFilterOption } from './types';

afterEach(() => {
  document.body.replaceChildren();
});

const PEOPLE: DataTableFilterOption[] = [
  { value: '7', label: 'Ana García' },
  { value: '9', label: 'Luis Pérez' },
];

function mountLookup(props: Record<string, unknown> = {}, locale: 'en' | 'es' = 'en') {
  return mount(DataTableLookup, {
    props: { label: 'Employee', value: '', load: vi.fn(async () => PEOPLE), testid: 'staff-filter-user_id', debounce: 0, ...props },
    global: { plugins: [createShellI18n({ locale })] },
    attachTo: document.body,
  });
}

type Lookup = ReturnType<typeof mountLookup>;
/** The element with the hook (the group itself carries the bare one). */
const hook = (w: Lookup, suffix = '') => {
  const selector = `[data-testid="staff-filter-user_id${suffix}"]`;
  return ((w.element as HTMLElement).matches(selector) ? w.element : w.element.querySelector(selector)) as HTMLElement | null;
};
const all = (w: Lookup, suffix: string) => [...w.element.querySelectorAll(`[data-testid="staff-filter-user_id${suffix}"]`)] as HTMLElement[];
const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
/** An ARIA attribute of an Ionic control, on its host or its native element. */
const aria = (el: HTMLElement, name: string) => el.getAttribute(name) ?? (el.shadowRoot ?? el).querySelector(`[${name}]`)?.getAttribute(name) ?? null;

const input = (w: Lookup) => hook(w, '-search') as HTMLInputElement;
async function focus(w: Lookup): Promise<void> {
  input(w).dispatchEvent(new FocusEvent('focus'));
  await flushPromises();
}
async function type(w: Lookup, value: string): Promise<void> {
  input(w).value = value;
  input(w).dispatchEvent(new Event('input', { bubbles: true }));
  await flushPromises();
}
/** A key on the search box; returns the event (to read `defaultPrevented`). */
async function key(w: Lookup, name: string): Promise<KeyboardEvent> {
  const ev = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true });
  input(w).dispatchEvent(ev);
  await flushPromises();
  return ev;
}

describe('DataTableLookup', () => {
  it('a named group: the field’s label, a search box, nothing asked before the person comes to it', () => {
    const load = vi.fn(async () => PEOPLE);
    const w = mountLookup({ load });
    expect(hook(w)!.getAttribute('role')).toBe('group');
    expect(hook(w)!.getAttribute('aria-label')).toBe('Employee');
    expect(text(w.element.querySelector('.data-table-lookup__label'))).toBe('Employee');
    expect(input(w).localName).toBe('input');
    expect(input(w).labels?.[0]?.textContent?.trim()).toBe('Employee');
    expect(hook(w, '-chosen')).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it('on focus it lists the first matches; typing asks for what is typed; a pick emits the value and its label and folds the list', async () => {
    const load = vi.fn(async (query: string) => PEOPLE.filter((p) => p.label.toLowerCase().includes(query.toLowerCase())));
    const w = mountLookup({ load });
    await focus(w);
    expect(load).toHaveBeenCalledWith('');
    expect(all(w, '-option').map((el) => el.getAttribute('data-value'))).toEqual(['7', '9']);
    await focus(w);
    expect(load).toHaveBeenCalledTimes(1);
    await type(w, '  luis ');
    expect(load).toHaveBeenLastCalledWith('luis');
    expect(all(w, '-option').map(text)).toEqual(['Luis Pérez']);
    all(w, '-option')[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();
    expect(w.emitted('change')).toEqual([['9', 'Luis Pérez']]);
    expect(all(w, '-option')).toHaveLength(0);
    expect(input(w).value).toBe('');
  });

  it('names the current choice (its label, else the value) and clears it', async () => {
    const w = mountLookup({ value: '7', display: 'Ana García' });
    expect(text(hook(w, '-chosen'))).toBe('Ana García');
    const clear = hook(w, '-clear')!;
    expect(aria(clear, 'aria-label')).toBe('Clear Employee');
    clear.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();
    expect(w.emitted('change')).toEqual([['', '']]);
    await w.setProps({ value: '12', display: undefined });
    expect(text(hook(w, '-chosen'))).toBe('12');
  });

  it('says it is loading, and that nothing matched', async () => {
    let answer: (options: DataTableFilterOption[]) => void = () => {};
    const load = vi.fn(() => new Promise<DataTableFilterOption[]>((resolve) => (answer = resolve)));
    const w = mountLookup({ load });
    await focus(w);
    expect(hook(w, '-loading')!.getAttribute('role')).toBe('status');
    expect(text(hook(w, '-loading'))).toBe('Loading…');
    answer([]);
    await flushPromises();
    expect(hook(w, '-loading')).toBeNull();
    expect(text(hook(w, '-empty'))).toBe('No matches');
  });

  it('a failed answer is said with «Retry», which asks again for the same text', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(PEOPLE);
    const w = mountLookup({ load });
    await type(w, 'an');
    expect(hook(w, '-error')!.getAttribute('role')).toBe('alert');
    expect(text(hook(w, '-error'))).toContain("Couldn't load the data");
    hook(w, '-retry')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();
    expect(load).toHaveBeenLastCalledWith('an');
    expect(hook(w, '-error')).toBeNull();
    expect(all(w, '-option')).toHaveLength(2);
  });

  it('a late answer to an older text never replaces the newer one', async () => {
    const answers: Array<(options: DataTableFilterOption[]) => void> = [];
    const load = vi.fn(() => new Promise<DataTableFilterOption[]>((resolve) => answers.push(resolve)));
    const w = mountLookup({ load });
    await type(w, 'a');
    await type(w, 'lu');
    answers[1]([PEOPLE[1]]);
    await flushPromises();
    answers[0](PEOPLE);
    await flushPromises();
    expect(all(w, '-option').map(text)).toEqual(['Luis Pérez']);
  });

  it('paints the server’s refusal under the field, tied to the search box', () => {
    const w = mountLookup({ errorText: 'Unknown employee.' });
    const error = hook(w, '-field-error')!;
    expect(text(error)).toBe('Unknown employee.');
    expect(input(w).getAttribute('aria-describedby')).toBe(error.id);
  });

  it('speaks Spanish', async () => {
    const w = mountLookup({ value: '7', display: 'Ana García', load: vi.fn(async () => []) }, 'es');
    expect(aria(hook(w, '-clear')!, 'aria-label')).toBe('Quitar Employee');
    expect(input(w).placeholder).toBe('Buscar…');
    await focus(w);
    expect(text(hook(w, '-empty'))).toBe('Sin coincidencias');
  });

  it('is a combobox over a listbox: expanded while options are listed, each option named and marked when chosen', async () => {
    const load = async (query: string) => PEOPLE.filter((p) => p.label.toLowerCase().includes(query));
    const w = mountLookup({ value: '9', display: 'Luis Pérez', load });
    const box = input(w);
    expect(box.getAttribute('role')).toBe('combobox');
    expect(box.getAttribute('aria-autocomplete')).toBe('list');
    expect(box.getAttribute('aria-expanded')).toBe('false');
    await focus(w);
    expect(box.getAttribute('aria-expanded')).toBe('true');
    const list = w.element.querySelector(`#${box.getAttribute('aria-controls')}`)!;
    expect(list.getAttribute('role')).toBe('listbox');
    expect(list.getAttribute('aria-label')).toBe('Employee');
    expect(all(w, '-option').map((o) => [o.getAttribute('role'), o.getAttribute('aria-selected')])).toEqual([
      ['option', 'false'],
      ['option', 'true'],
    ]);
    await type(w, 'nobody');
    expect(box.getAttribute('aria-expanded')).toBe('false');
  });

  it('the arrows move the active option (aria-activedescendant), Enter picks it', async () => {
    const w = mountLookup();
    await key(w, 'ArrowDown');
    const options = () => all(w, '-option');
    expect(input(w).getAttribute('aria-activedescendant')).toBe(options()[0].id);
    expect(options()[0].classList.contains('data-table-lookup__option--active')).toBe(true);
    await key(w, 'ArrowDown');
    await key(w, 'ArrowDown');
    expect(input(w).getAttribute('aria-activedescendant')).toBe(options()[1].id);
    await key(w, 'ArrowUp');
    expect(input(w).getAttribute('aria-activedescendant')).toBe(options()[0].id);
    const enter = await key(w, 'Enter');
    expect(enter.defaultPrevented).toBe(true);
    expect(w.emitted('change')).toEqual([['7', 'Ana García']]);
    expect(input(w).hasAttribute('aria-activedescendant')).toBe(false);
    await key(w, 'ArrowDown');
    await key(w, 'ArrowDown');
    expect(input(w).getAttribute('aria-activedescendant')).toBe(options()[1].id);
    await key(w, 'Enter');
    expect(w.emitted('change')?.[1], 'Enter picks the active option, not the first').toEqual(['9', 'Luis Pérez']);
  });

  it('the arrows bring the active option into view when the list scrolls', async () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ value: String(i + 1), label: `Person ${i + 1}` }));
    const scrolled = vi.fn();
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(function (this: Element, options) {
      scrolled(this.id, options);
    });
    try {
      const w = mountLookup({ load: vi.fn(async () => many) });
      for (let i = 0; i < 12; i += 1) await key(w, 'ArrowDown');
      const active = input(w).getAttribute('aria-activedescendant');
      expect(active).toBe(all(w, '-option')[11].id);
      expect(scrolled).toHaveBeenLastCalledWith(active, { block: 'nearest' });
      await key(w, 'ArrowUp');
      expect(scrolled).toHaveBeenLastCalledWith(all(w, '-option')[10].id, { block: 'nearest' });
    } finally {
      spy.mockRestore();
    }
  });

  it('Escape folds an open list and stops there; with the list folded it is left to the panel', async () => {
    const w = mountLookup();
    await focus(w);
    const fold = await key(w, 'Escape');
    expect(fold.defaultPrevented).toBe(true);
    expect(input(w).getAttribute('aria-expanded')).toBe('false');
    expect(all(w, '-option')).toHaveLength(0);
    const leave = await key(w, 'Escape');
    expect(leave.defaultPrevented).toBe(false);
    const enter = await key(w, 'Enter');
    expect(enter.defaultPrevented).toBe(false);
    expect(w.emitted('change')).toBeUndefined();
  });

  it('back to the box after Escape, it asks again for the text still in it, not for everything', async () => {
    const load = vi.fn(async () => PEOPLE);
    const w = mountLookup({ load });
    await focus(w);
    await type(w, 'lu');
    await key(w, 'Escape');
    expect(input(w).value).toBe('lu');
    await focus(w);
    expect(load.mock.calls.at(-1)).toEqual(['lu']);
  });

  it('asks once the person stops typing (300 ms by default)', async () => {
    vi.useFakeTimers();
    try {
      const load = vi.fn(async () => PEOPLE);
      const w = mountLookup({ load, debounce: undefined });
      input(w).value = 'a';
      input(w).dispatchEvent(new Event('input'));
      input(w).value = 'an';
      input(w).dispatchEvent(new Event('input'));
      expect(load).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(300);
      expect(load.mock.calls).toEqual([['an']]);
    } finally {
      vi.useRealTimers();
    }
  });
});
