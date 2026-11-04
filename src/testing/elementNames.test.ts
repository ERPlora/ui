// Ionic's element classes are anonymous (`class extends HTMLElement` in the minified build of
// @ionic/core), and Vitest prints an element as HTML only when its class has a name (the DOMElement
// printer of pretty-format). So a failing assertion about an `ion-*` element printed it as a plain
// object instead, walking from its properties into `window`, and the run ran out of memory before
// saying what had failed (ui#77). `nameElementClasses()` names each anonymous class after its tag at
// the moment it is registered; this package's tests run it first (`vitest.setup.ts`, checked in
// `setup.test.ts`).
import { afterEach, describe, expect, it, vi } from 'vitest';

import { nameElementClasses } from './elementNames';

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('nameElementClasses', () => {
  it('an element class without a name takes one from its tag', () => {
    nameElementClasses();
    customElements.define('ep-probe-unnamed', class extends HTMLElement {});
    expect(customElements.get('ep-probe-unnamed')?.name).toBe('EpProbeUnnamedElement');
  });

  it('so Vitest prints the element as HTML, not as an object that walks the whole window (ui#77)', () => {
    nameElementClasses();
    customElements.define('ep-probe-printed', class extends HTMLElement {});
    const probe = document.createElement('ep-probe-printed');
    probe.setAttribute('role', 'button');
    probe.textContent = 'Invite';
    expect(probe).toMatchInlineSnapshot(`
      <ep-probe-printed
        role="button"
      >
        Invite
      </ep-probe-printed>
    `);
  });

  it('a class with its own name keeps it', () => {
    nameElementClasses();
    class ProbeNamed extends HTMLElement {}
    customElements.define('ep-probe-named', ProbeNamed);
    expect(customElements.get('ep-probe-named')).toBe(ProbeNamed);
    expect(ProbeNamed.name).toBe('ProbeNamed');
  });

  it('the registry still decides: a tag defined twice throws as before', () => {
    nameElementClasses();
    customElements.define('ep-probe-twice', class extends HTMLElement {});
    expect(() => customElements.define('ep-probe-twice', class extends HTMLElement {})).toThrow();
  });

  it('can run twice (each test file runs the setup): `define` is wrapped once', () => {
    nameElementClasses();
    const define = customElements.define;
    nameElementClasses();
    expect(customElements.define).toBe(define);
  });

  it('without a DOM it does nothing', () => {
    vi.stubGlobal('customElements', undefined);
    expect(() => nameElementClasses()).not.toThrow();
  });
});
