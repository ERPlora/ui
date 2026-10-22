// ColorInput — one colour of a form (a website's brand colours): an ion-item with a native colour
// swatch and an ion-input with the hex text. `v-model` is a `#rrggbb` string; the text only reaches
// the page when it is a valid colour, and a wrong one says why once the person leaves the field.
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';

import { createShellI18n } from '../../shell/i18n';
import ColorInput from './ColorInput.vue';

type El = HTMLElement & Record<string, unknown>;

function mountColor(props: Record<string, unknown> = {}, locale = 'en') {
  return mount(ColorInput, {
    props: { modelValue: '#1a73e8', label: 'Primary colour', testid: 'brand', ...props },
    attachTo: document.body,
    global: { plugins: [createShellI18n({ locale })] },
  });
}

type Wrapper = ReturnType<typeof mountColor>;

/** Lets Vue render and Ionic's ion-input load. */
async function settle(): Promise<void> {
  for (let i = 0; i < 4; i++) {
    await nextTick();
    await flushPromises();
  }
}

const field = (w: Wrapper) => w.get('ion-input[data-testid="brand"]');
const fieldEl = (w: Wrapper) => field(w).element as El;
const swatch = (w: Wrapper) => w.get('input[type="color"]').element as HTMLInputElement;

async function typeIn(w: Wrapper, value: string) {
  field(w).element.dispatchEvent(new CustomEvent('ionInput', { detail: { value } }));
  await settle();
}
async function leave(w: Wrapper) {
  field(w).element.dispatchEvent(new CustomEvent('ionBlur'));
  await settle();
}
async function pick(w: Wrapper, value: string) {
  const input = swatch(w);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await settle();
}
const showsError = (w: Wrapper) => field(w).classes().includes('ion-invalid') && field(w).classes().includes('ion-touched');

afterEach(() => {
  document.body.replaceChildren();
});

describe('ColorInput: what it paints', () => {
  it('is an ion-item with the swatch and an ion-input carrying the label above the hex text', async () => {
    const w = mountColor();
    await settle();
    expect(w.find('ion-item').exists()).toBe(true);
    const input = fieldEl(w);
    expect(input.label).toBe('Primary colour');
    expect(input.labelPlacement).toBe('stacked');
    expect(input.value).toBe('#1a73e8');
    // iOS by default: no `fill="outline"` (it only paints in md).
    expect(input.fill).toBeUndefined();
    expect(swatch(w).value).toBe('#1a73e8');
    expect(w.get('[data-testid="brand-swatch"]').element).toBe(swatch(w));
    expect(showsError(w)).toBe(false);
  });

  it('names the swatch after the field, for assistive tech', async () => {
    const w = mountColor();
    await settle();
    expect(swatch(w).getAttribute('aria-label')).toBe('Pick “Primary colour” on a palette');
  });

  it('follows the page: a new value repaints the text and the swatch', async () => {
    const w = mountColor();
    await settle();
    await w.setProps({ modelValue: '#00aa55' });
    await settle();
    expect(fieldEl(w).value).toBe('#00aa55');
    expect(swatch(w).value).toBe('#00aa55');
  });

  it('a new value from the page is a fresh field: a wrong text waits again until it is left', async () => {
    const w = mountColor();
    await settle();
    await typeIn(w, 'nope');
    await leave(w);
    await w.setProps({ modelValue: '#00aa55' });
    await settle();
    expect(showsError(w)).toBe(false);
    await typeIn(w, '#12');
    expect(showsError(w)).toBe(false);
    await leave(w);
    expect(showsError(w)).toBe(true);
  });

  it('a value that is not a colour leaves the text as given and paints the swatch black', async () => {
    const w = mountColor({ modelValue: '' });
    await settle();
    expect(fieldEl(w).value).toBe('');
    expect(swatch(w).value).toBe('#000000');
    expect(showsError(w)).toBe(false);
  });

  it('disabled: neither the swatch nor the text can be changed', async () => {
    const w = mountColor({ disabled: true });
    await settle();
    expect(swatch(w).disabled).toBe(true);
    expect(fieldEl(w).disabled).toBe(true);
    await typeIn(w, '#ffffff');
    await pick(w, '#ffffff');
    expect(w.emitted('update:modelValue')).toBeUndefined();
  });
});

describe('ColorInput: typing the hex', () => {
  it('a valid colour reaches the page in lower case', async () => {
    const w = mountColor();
    await settle();
    await typeIn(w, '#FF8800');
    expect(w.emitted('update:modelValue')).toEqual([['#ff8800']]);
  });

  it('takes it without the hash and with spaces around', async () => {
    const w = mountColor();
    await settle();
    await typeIn(w, '  00Aa55 ');
    expect(w.emitted('update:modelValue')).toEqual([['#00aa55']]);
  });

  it('an invalid text reaches nobody, and leaving the field says why', async () => {
    const w = mountColor();
    await settle();
    await typeIn(w, '#12345');
    expect(w.emitted('update:modelValue')).toBeUndefined();
    // Not while the person is still typing it.
    expect(showsError(w)).toBe(false);
    await leave(w);
    expect(showsError(w)).toBe(true);
    expect(fieldEl(w).errorText).toBe('Write the colour as #RRGGBB, for example #1A73E8.');
    for (const wrong of ['#gggggg', '#1234567', 'red', '#fff', '']) {
      await typeIn(w, wrong);
      expect(showsError(w)).toBe(true);
    }
    expect(w.emitted('update:modelValue')).toBeUndefined();
  });

  it('the error goes away as soon as the text is a colour again', async () => {
    const w = mountColor();
    await settle();
    await typeIn(w, 'nope');
    await leave(w);
    expect(showsError(w)).toBe(true);
    await typeIn(w, '#abcdef');
    expect(showsError(w)).toBe(false);
    expect(w.emitted('update:modelValue')).toEqual([['#abcdef']]);
  });

  it('the colour it already has is not sent again', async () => {
    const w = mountColor();
    await settle();
    await typeIn(w, '#1A73E8');
    expect(w.emitted('update:modelValue')).toBeUndefined();
  });

  it('leaving a valid text says nothing', async () => {
    const w = mountColor();
    await settle();
    await leave(w);
    expect(showsError(w)).toBe(false);
  });

  it('speaks Spanish', async () => {
    const w = mountColor({}, 'es');
    await settle();
    expect(swatch(w).getAttribute('aria-label')).toBe('Elegir «Primary colour» en la paleta');
    await typeIn(w, 'x');
    await leave(w);
    expect(fieldEl(w).errorText).toBe('Escribe el color como #RRGGBB, por ejemplo #1A73E8.');
  });
});

describe('ColorInput: the swatch', () => {
  it('what is picked reaches the page', async () => {
    const w = mountColor();
    await settle();
    await pick(w, '#00ff00');
    expect(w.emitted('update:modelValue')).toEqual([['#00ff00']]);
  });

  it('picking a colour clears a wrong text and its error', async () => {
    const w = mountColor();
    await settle();
    await typeIn(w, 'nope');
    await leave(w);
    await pick(w, '#00ff00');
    expect(showsError(w)).toBe(false);
    expect(fieldEl(w).value).toBe('#00ff00');
  });
});
