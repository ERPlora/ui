import { describe, expect, it, vi } from 'vitest';

import {
  bootIonicSelectText,
  defaultSelectText,
  setSelectTextTranslator,
  type SelectTextProp,
} from './ionic-select-text';

// hub#1736 / hub#2226: the Cancel/OK buttons of select dialogs speak the language active
// when the dialog OPENS.
class FakeSelect extends HTMLElement {
  cancelText = 'Cancel';
  okText = 'OK';
  seen: Array<{ cancel: string; ok: string }> = [];
  async open(): Promise<void> {
    this.seen.push({ cancel: this.cancelText, ok: this.okText });
  }
}

const mount = (setup?: (el: FakeSelect) => void): FakeSelect => {
  const el = document.createElement('x-text-sel') as FakeSelect;
  setup?.(el);
  document.body.appendChild(el);
  return el;
};

describe('defaultSelectText', () => {
  it('answers English by default', () => {
    document.documentElement.lang = 'en';
    expect(defaultSelectText('cancelText')).toBe('Cancel');
    expect(defaultSelectText('okText')).toBe('OK');
  });

  it('answers Spanish from the html lang', () => {
    document.documentElement.lang = 'es-ES';
    expect(defaultSelectText('cancelText')).toBe('Cancelar');
    expect(defaultSelectText('okText')).toBe('Aceptar');
    document.documentElement.lang = 'en';
  });

  it('uses an injected translator when there is one', () => {
    setSelectTextTranslator((key) => `t:${key}`);
    expect(defaultSelectText('okText')).toBe('t:selectDialog.ok');
    setSelectTextTranslator(undefined);
  });
});

describe('bootIonicSelectText', () => {
  let lang = 'en';
  const resolver = (prop: SelectTextProp): string =>
    ({ en: { cancelText: 'Cancel', okText: 'OK' }, es: { cancelText: 'Cancelar', okText: 'Aceptar' } })[
      lang as 'en' | 'es'
    ][prop];
  bootIonicSelectText(resolver, ['x-text-sel']);
  customElements.define('x-text-sel', FakeSelect);

  it('labels the buttons in the language active at open time, even after a switch', async () => {
    const el = mount();
    lang = 'es';
    await el.open();
    lang = 'en';
    await el.open();
    expect(el.seen).toEqual([
      { cancel: 'Cancelar', ok: 'Aceptar' },
      { cancel: 'Cancel', ok: 'OK' },
    ]);
  });

  it('never overrides a label chosen in markup or from JS', async () => {
    lang = 'es';
    const el = mount((e) => {
      e.setAttribute('cancel-text', 'Cancel');
      e.okText = 'Done';
    });
    await el.open();
    expect(el.seen[0]).toEqual({ cancel: 'Cancel', ok: 'Done' });
  });

  it('falls back to Ionic English and reports once when the resolver throws', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    customElements.define('x-text-sel2', class extends FakeSelect {});
    bootIonicSelectText(() => {
      throw new Error('no catalogue');
    }, ['x-text-sel2']);
    const el = document.createElement('x-text-sel2') as FakeSelect;
    document.body.appendChild(el);
    await el.open();
    await el.open();
    expect(el.seen[0]).toEqual({ cancel: 'Cancel', ok: 'OK' });
    expect(error.mock.calls.filter(([m]) => String(m).includes('did not answer'))).toHaveLength(2);
    error.mockRestore();
  });
});
