// DataTableLookup — the `lookup` column filter (FIX-DATATABLE, the Hub's SearchSelect filters: staff, roles,
// accounts…): one choice among more than a list can hold, inside the table's filters panel (no dialog of its
// own). The current choice is named (with a clear button); a search box asks the page's `load` for what is
// typed (the first matches on focus) and lists them; loading, empty and failed answers are said, a failure
// with «Retry»; the server's refusal (`filterErrors`) is painted under the field.
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
    props: { label: 'Employee', value: '', load: vi.fn(async () => PEOPLE), testid: 'staff-filter-user_id', ...props },
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

async function focus(w: Lookup): Promise<void> {
  hook(w, '-search')!.dispatchEvent(new CustomEvent('ionFocus'));
  await flushPromises();
}
async function type(w: Lookup, value: string): Promise<void> {
  hook(w, '-search')!.dispatchEvent(new CustomEvent('ionInput', { detail: { value } }));
  await flushPromises();
}

describe('DataTableLookup', () => {
  it('a named group: the field’s label, a search box, nothing asked before the person comes to it', () => {
    const load = vi.fn(async () => PEOPLE);
    const w = mountLookup({ load });
    expect(hook(w)!.getAttribute('role')).toBe('group');
    expect(hook(w)!.getAttribute('aria-label')).toBe('Employee');
    expect(text(w.element.querySelector('.data-table-lookup__label'))).toBe('Employee');
    expect(hook(w, '-search')!.localName).toBe('ion-searchbar');
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
    expect((hook(w, '-search') as HTMLElement & { value?: string }).value).toBe('');
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

  it('marks the current choice in the list', async () => {
    const w = mountLookup({ value: '9', display: 'Luis Pérez' });
    await focus(w);
    expect(all(w, '-option').map((el) => el.getAttribute('aria-current'))).toEqual([null, 'true']);
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
    expect(aria(hook(w, '-search')!, 'aria-describedby')).toBe(error.id);
  });

  it('speaks Spanish', async () => {
    const w = mountLookup({ value: '7', display: 'Ana García', load: vi.fn(async () => []) }, 'es');
    expect(aria(hook(w, '-clear')!, 'aria-label')).toBe('Quitar Employee');
    expect((hook(w, '-search') as HTMLElement & { placeholder?: string }).placeholder).toBe('Buscar…');
    await focus(w);
    expect(text(hook(w, '-empty'))).toBe('Sin coincidencias');
  });
});
