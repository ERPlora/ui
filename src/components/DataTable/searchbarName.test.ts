// outfitkit#182 — Ionic 8's `ion-searchbar` names its inner <input> with a constant
// `aria-label="search text"`, so screen readers announce «search text» instead of the visible hint.
import { afterEach, describe, expect, it, vi } from 'vitest';

import { syncSearchbarInputName } from './searchbarName';

/** Stand-in for Ionic's `ion-searchbar`: a scoped component whose inner input carries a constant
 *  name, reachable through the async `getInputElement()`. */
class FakeIonSearchbar extends HTMLElement {
  private input?: HTMLInputElement;
  connectedCallback(): void {
    if (this.input) return;
    this.input = document.createElement('input');
    this.input.setAttribute('aria-label', 'search text');
    this.appendChild(this.input);
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

afterEach(() => {
  document.body.replaceChildren();
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
