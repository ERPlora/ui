// outfitkit#182 — Ionic 8's `ion-searchbar` names its inner <input> with a constant
// `aria-label="search text"`, so screen readers announce «search text» instead of the visible hint.
// FIX-UI-SEARCHBAR-CLEAR-BUTTON-SAYS-RESET — its clear button is a constant `aria-label="reset"`, in
// English whatever the person's language.
import { afterEach, describe, expect, it, vi } from 'vitest';

import { syncSearchbarInputName } from './searchbarName';

/** Stand-in for Ionic's `ion-searchbar`: a scoped component whose inner input and clear button carry
 *  constant names, reachable once the async `getInputElement()` resolves. */
class FakeIonSearchbar extends HTMLElement {
  private input?: HTMLInputElement;
  connectedCallback(): void {
    if (this.input) return;
    this.input = document.createElement('input');
    this.input.setAttribute('aria-label', 'search text');
    const clear = document.createElement('button');
    clear.className = 'searchbar-clear-button';
    clear.setAttribute('aria-label', 'reset');
    this.append(this.input, clear);
  }
  async getInputElement(): Promise<HTMLInputElement> {
    if (!this.input) throw new Error('not rendered');
    return this.input;
  }
}

const settle = () => new Promise((r) => setTimeout(r, 0));

function host(): HTMLElement {
  const root = document.createElement('div');
  root.appendChild(document.createElement('ion-searchbar'));
  document.body.appendChild(root);
  return root;
}

const inputName = (root: HTMLElement) => root.querySelector('ion-searchbar input')?.getAttribute('aria-label');
const clearName = (root: HTMLElement) =>
  root.querySelector('ion-searchbar button.searchbar-clear-button')?.getAttribute('aria-label');

afterEach(() => {
  document.body.replaceChildren();
  document.documentElement.lang = '';
});

describe('syncSearchbarInputName', () => {
  // Must stay FIRST: once `ion-searchbar` is defined in this file it cannot be undefined again.
  it('names the input when Ionic registers ion-searchbar after the table rendered', async () => {
    const root = host();
    syncSearchbarInputName(root, () => 'Search users…');
    customElements.define('ion-searchbar', FakeIonSearchbar);
    await settle();
    expect(inputName(root)).toBe('Search users…');
  });

  it('follows a change of the hint (the name is read when the input resolves)', async () => {
    const root = host();
    let hint = 'Search users…';
    syncSearchbarInputName(root, () => hint);
    hint = 'Search invoices…';
    await settle();
    expect(inputName(root)).toBe('Search invoices…');
  });

  it('does nothing without a searchbar; a searchbar torn down mid-flight is not an error', async () => {
    const report = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => syncSearchbarInputName(document.createElement('div'), () => 'x')).not.toThrow();
    const detached = document.createElement('div');
    detached.appendChild(Object.assign(document.createElement('ion-searchbar'), { getInputElement: () => Promise.reject(new Error('torn down')) }));
    expect(() => syncSearchbarInputName(detached, () => 'x')).not.toThrow();
    await settle();
    expect(report).not.toHaveBeenCalled();
    report.mockRestore();
  });

  it('a searchbar still on screen that cannot be named is reported, not swallowed', async () => {
    const report = vi.spyOn(console, 'error').mockImplementation(() => {});
    const root = host();
    Object.assign(root.querySelector('ion-searchbar') as unknown as HTMLElement, { getInputElement: () => Promise.reject(new Error('boom')) });
    syncSearchbarInputName(root, () => 'x');
    await settle();
    expect(report).toHaveBeenCalledOnce();
    report.mockRestore();
  });
});

describe('the clear button is named in the person’s language, never «reset»', () => {
  it('takes the name it is given, and the input keeps its own', async () => {
    const root = host();
    syncSearchbarInputName(root, () => 'Buscar producto…', () => 'Borrar la búsqueda de productos');
    await settle();
    expect(clearName(root)).toBe('Borrar la búsqueda de productos');
    expect(inputName(root)).toBe('Buscar producto…');
  });

  it.each([
    ['es', 'Borrar búsqueda'],
    ['es-ES', 'Borrar búsqueda'],
    ['en', 'Clear search'],
    ['', 'Clear search'],
  ])('a call of today (no name for it) names it in the language of the page: <html lang="%s"> → «%s»', async (lang, name) => {
    document.documentElement.lang = lang;
    const root = host();
    syncSearchbarInputName(root, () => 'Search…');
    await settle();
    expect(clearName(root)).toBe(name);
    expect(inputName(root)).toBe('Search…');
  });

  it('is read when the input resolves: a call that resolves late does not bring back an older language', async () => {
    document.documentElement.lang = 'en';
    const root = host();
    const bar = root.querySelector('ion-searchbar') as unknown as FakeIonSearchbar;
    const own = bar.getInputElement.bind(bar);
    let release!: () => void;
    const late = new Promise<void>((r) => (release = r));
    let asked = 0;
    // The first call's input resolves only on `release()`, after the second one's.
    bar.getInputElement = () => (asked++ === 0 ? late.then(own) : own());
    syncSearchbarInputName(root, () => 'Search…');
    document.documentElement.lang = 'es';
    syncSearchbarInputName(root, () => 'Buscar…');
    await settle();
    expect(clearName(root)).toBe('Borrar búsqueda');
    release();
    await settle();
    expect(clearName(root)).toBe('Borrar búsqueda');
  });

  it('a searchbar without a clear button (another Ionic) still gets its input named, and nothing is reported', async () => {
    const report = vi.spyOn(console, 'error').mockImplementation(() => {});
    const root = host();
    root.querySelector('ion-searchbar button.searchbar-clear-button')?.remove();
    syncSearchbarInputName(root, () => 'Search…');
    await settle();
    expect(inputName(root)).toBe('Search…');
    expect(report).not.toHaveBeenCalled();
    report.mockRestore();
  });

  it('a searchbar torn down mid-flight is not an error, with or without a name for the clear button', async () => {
    const report = vi.spyOn(console, 'error').mockImplementation(() => {});
    const detached = document.createElement('div');
    detached.appendChild(Object.assign(document.createElement('ion-searchbar'), { getInputElement: () => Promise.reject(new Error('torn down')) }));
    expect(() => syncSearchbarInputName(detached, () => 'x', () => 'y')).not.toThrow();
    expect(() => syncSearchbarInputName(detached, () => 'x')).not.toThrow();
    await settle();
    expect(report).not.toHaveBeenCalled();
    report.mockRestore();
  });
});
