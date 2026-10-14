// happy-dom diverges from a browser in two places Ionic's runtime reaches when one of its elements
// connects to the document, and each divergence throws inside Stencil, which logs it: the
// «TypeError: Cannot read properties of undefined (reading 'replace' | 'toLowerCase')» noise of
// the component tests.
//   - `CSSStyleSheet.replaceSync(undefined)`: a browser converts the argument to text (WebIDL
//     USVString); happy-dom calls `.replace` on it. Stencil passes `undefined` when no Ionic mode is
//     set up (the app's `IonicVue` sets it; a component test mounts without it).
//   - `document.dir`: a browser reflects `<html dir>` ('' by default); happy-dom has no such
//     property, and Ionic's `isRTL` lowercases it.
// This package's tests run with both gaps filled (`vitest.setup.ts`); the apps can do the same.
import { IonContent } from '@ionic/vue';
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fillHappyDomGaps } from './happyDom';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('the test environment behaves as a browser where Ionic reaches it', () => {
  it('an Ionic element connects and renders without the runtime logging an error', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const wrapper = mount(IonContent, { attachTo: document.body });
    await new Promise((resolve) => setTimeout(resolve, 0));
    wrapper.unmount();
    expect(errors).not.toHaveBeenCalled();
  });

  it('`replaceSync` takes any value as text, and `document.dir` reflects <html dir>', () => {
    expect(() => new CSSStyleSheet().replaceSync(undefined as unknown as string)).not.toThrow();
    expect(document.dir).toBe('');
  });
});

describe('fillHappyDomGaps', () => {
  it('`document.dir` reads and writes the `dir` of <html>, as a browser does', () => {
    fillHappyDomGaps();
    document.documentElement.setAttribute('dir', 'RTL');
    expect(document.dir).toBe('RTL');
    document.dir = 'ltr';
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
    document.documentElement.removeAttribute('dir');
    expect(document.dir).toBe('');
  });

  it('`replaceSync` still parses real CSS, and a value that is not text becomes its text', () => {
    fillHappyDomGaps();
    const sheet = new CSSStyleSheet();
    sheet.replaceSync('.a { color: red; }');
    expect(sheet.cssRules).toHaveLength(1);
    sheet.replaceSync(undefined as unknown as string);
    expect(sheet.cssRules).toHaveLength(0);
  });

  it('can run twice (each test file runs the setup): the second time changes nothing', () => {
    fillHappyDomGaps();
    const replaceSync = CSSStyleSheet.prototype.replaceSync;
    const dir = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(document), 'dir');
    fillHappyDomGaps();
    expect(CSSStyleSheet.prototype.replaceSync).toBe(replaceSync);
    expect(Object.getOwnPropertyDescriptor(Object.getPrototypeOf(document), 'dir')).toEqual(dir);
  });
});
