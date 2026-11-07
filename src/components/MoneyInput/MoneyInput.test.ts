// MoneyInput — the one money field of every form (a price, a cost, a supplement, a payment, a rule's amount): an
// outlined md text field with the decimal keyboard, in the field's `money`. It hands the page what is typed and, on
// leaving it, rewrites a readable amount in the page format; what is not an amount says so under the field (or both
// readings of «1.250») once the person leaves it or tries to save, and the server's message for the field wins. Until
// its money is known the field neither rewrites nor judges what was typed: «150» is not made «150.00» and «¥1500» or
// «12,50 zł» are not called «not an amount» before the business says its currency (hub#918, hub#921, hub#945). A
// `signed` amount (a supplement) may be negative, with a ± button for a phone's decimal keyboard, which has no minus.
import { flushPromises, mount } from '@vue/test-utils';
import { IonInput } from '@ionic/vue';
import { afterEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';

import { createShellI18n } from '../../shell/i18n';
import { formatMoney, type Money } from '../format';
import MoneyInput from './MoneyInput.vue';

type Control = HTMLElement & { errorText?: string; disabled?: boolean };

const EUR: Money = { currency: 'EUR', decimals: 2 };
const PLN: Money = { currency: 'PLN', decimals: 2 };
const JPY: Money = { currency: 'JPY', decimals: 0 };

const NOT_AMOUNT = 'This is not an amount. Type a figure, for example 12.50.';
const NOT_AMOUNT_SIGNED = 'This is not an amount. Type a figure, for example 1.50, or -0.50 for a discount.';
const NOT_AMOUNT_ES = 'Esto no es un importe. Escribe una cifra, por ejemplo 12,50.';

/** Lets Vue render and Ionic's ion-input load. */
async function settle(): Promise<void> {
  for (let i = 0; i < 4; i++) {
    await nextTick();
    await flushPromises();
  }
}

async function setup(props: Record<string, unknown> = {}, locale: 'en' | 'es' = 'en') {
  const model = { value: (props.modelValue as string) ?? '' };
  const wrapper = mount(MoneyInput, {
    props: {
      modelValue: model.value,
      label: 'Price',
      testid: 'price',
      'onUpdate:modelValue': (value: string) => {
        model.value = value;
        void wrapper.setProps({ modelValue: value });
      },
      ...props,
    },
    attachTo: document.body,
    global: { plugins: [createShellI18n({ locale })] },
  });
  await settle();
  const input = () => wrapper.findComponent(IonInput);
  async function type(value: string) {
    await input().setValue(value);
    await settle();
  }
  async function leave() {
    input().element.dispatchEvent(new CustomEvent('ionBlur'));
    await settle();
  }
  async function money(value: Money | undefined) {
    await wrapper.setProps({ money: value });
    await settle();
  }
  // Ionic's property holds '' once Vue clears it: no message either way.
  const errorText = () => (input().element as Control).errorText || undefined;
  const marked = () => ['ion-invalid', 'ion-touched'].every((name) => input().classes().includes(name));
  const sign = () => document.querySelector<HTMLElement>('[data-testid="price-sign"]');
  /** What a screen reader and a click reach: Ionic moves the host's `aria-*` onto its native button. */
  const signButton = () => sign()?.shadowRoot?.querySelector('button');
  return { wrapper, model, input, type, leave, money, errorText, marked, sign, signButton };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('MoneyInput: what it paints', () => {
  it('is an outlined md text field with its label, the decimal keyboard and its test id; no sign button', async () => {
    const s = await setup({ money: EUR });
    const input = s.input();
    expect([input.props('label'), input.props('fill'), input.attributes('mode'), input.props('inputmode'), input.props('type')]).toEqual([
      'Price',
      'outline',
      'md',
      'decimal',
      'text',
    ]);
    expect(input.attributes('data-testid')).toBe('price');
    expect(s.sign()).toBeNull();
    expect([s.errorText(), s.marked()]).toEqual([undefined, false]);
  });

  it('carries the helper text, and a disabled field disables its sign button too', async () => {
    const s = await setup({ money: EUR, helperText: 'Per unit', disabled: true, signed: true });
    expect([s.input().props('helperText'), s.input().props('disabled'), (s.sign() as Control | null)?.disabled]).toEqual([
      'Per unit',
      true,
      true,
    ]);
  });
});

describe('MoneyInput: once its money is known', () => {
  it('hands the page what is typed, as typed, and rewrites it in the page format on leaving', async () => {
    const s = await setup({ money: EUR }, 'es');
    await s.type('2.2');
    expect(s.model.value).toBe('2.2');
    await s.leave();
    expect([s.model.value, s.errorText()]).toEqual(['2,20', undefined]);
  });

  it('what is not an amount says so only once the person leaves the field, and marks it', async () => {
    const s = await setup({ money: EUR });
    await s.type('abc');
    expect([s.errorText(), s.marked()]).toEqual([undefined, false]);
    await s.leave();
    expect([s.model.value, s.errorText(), s.marked()]).toEqual(['abc', NOT_AMOUNT, true]);
    await s.type('12');
    expect([s.errorText(), s.marked()]).toEqual([undefined, false]);
  });

  it('after a save attempt (`showError`) it says so without leaving', async () => {
    const s = await setup({ money: EUR, modelValue: 'x', showError: true });
    expect([s.errorText(), s.marked()]).toEqual([NOT_AMOUNT, true]);
  });

  it('in the field’s currency: «12,5 zł» is read in złoty, a euro amount is not one', async () => {
    const s = await setup({ money: PLN }, 'es');
    await s.type('12,5 zł');
    await s.leave();
    expect([s.model.value, s.errorText()]).toEqual(['12,50', undefined]);
    await s.type('12,50 €');
    await s.leave();
    expect([s.model.value, s.errorText()]).toEqual(['12,50 €', NOT_AMOUNT_ES]);
  });

  it('with the currency’s decimals: in yen «1,5» is not an amount and «¥1500» stays 1500', async () => {
    const s = await setup({ money: JPY }, 'es');
    await s.type('1,5');
    await s.leave();
    expect(s.errorText()).toBe(NOT_AMOUNT_ES);
    await s.type('¥1500');
    await s.leave();
    expect([s.model.value, s.errorText()]).toEqual(['1500', undefined]);
  });

  it('«1.250» gives both readings, in the field’s currency', async () => {
    const s = await setup({ money: PLN, modelValue: '1.250', showError: true });
    expect(s.errorText()).toBe(
      `This amount can be read in two ways: «1.250» could be ${formatMoney(125000, 'en', PLN)} or ${formatMoney(125, 'en', PLN)}. Write the decimals so there is no doubt.`,
    );
    expect(s.errorText()).toContain('zł');
  });

  it('a price is never negative: a minus says it cannot be', async () => {
    const s = await setup({ money: EUR, modelValue: '-5', showError: true });
    expect(s.errorText()).toBe('This amount cannot be negative.');
  });

  it("the server's message for the field wins, also before its money is known", async () => {
    const message = 'Ensure this value is less than or equal to 9999999999999';
    const s = await setup({ money: EUR, modelValue: 'abc', showError: true, errorText: message });
    expect([s.errorText(), s.marked()]).toEqual([message, true]);
    await s.money(undefined);
    expect([s.errorText(), s.marked()]).toEqual([message, true]);
  });

  it('speaks Spanish', async () => {
    const s = await setup({ money: PLN, modelValue: '1.250', showError: true }, 'es');
    expect(s.errorText()?.replace(/\s/g, ' ')).toBe(
      'Este importe se puede leer de dos maneras: «1.250» tanto puede ser 1.250,00 zł como 1,25 zł. Escribe los decimales para que no haya duda.',
    );
    await s.wrapper.setProps({ modelValue: '-5' });
    await settle();
    expect(s.errorText()).toBe('Este importe no puede ser negativo.');
  });
});

// hub#918, hub#921, hub#945: the field's money (the business's, or a list's) may still be on its way. Its decimals and
// its sign are unknown until it arrives, so leaving the field keeps what was typed and nothing is judged: «¥1500»
// cannot be read without the yen. Once it arrives, what was left is read in it.
describe('MoneyInput: until its money is known', () => {
  it('leaving keeps what was typed: no decimals invented, and «150» left before the yen is still 150', async () => {
    const s = await setup({}, 'es');
    await s.type('150');
    await s.leave();
    expect([s.model.value, s.errorText()]).toEqual(['150', undefined]);
    await s.money(JPY);
    await s.leave();
    expect([s.model.value, s.errorText()]).toEqual(['150', undefined]);
  });

  it('«¥1500» or «12,50 zł» typed before the business says its currency are neither rewritten nor marked', async () => {
    const s = await setup({}, 'es');
    for (const text of ['¥1500', '12,50 zł', '1.250']) {
      await s.type(text);
      await s.leave();
      expect([s.model.value, s.errorText(), s.marked()], text).toEqual([text, undefined, false]);
    }
    await s.wrapper.setProps({ showError: true });
    await settle();
    expect([s.errorText(), s.marked()]).toEqual([undefined, false]);
  });

  it('once the money arrives, what was left is read in it: «¥1500» in yen is an amount, in euros it is not', async () => {
    const s = await setup({});
    await s.type('¥1500');
    await s.leave();
    await s.money(JPY);
    expect([s.errorText(), s.marked()]).toEqual([undefined, false]);
    await s.leave();
    expect(s.model.value).toBe('1500');
    await s.type('¥1500');
    await s.money(EUR);
    expect([s.errorText(), s.marked()]).toEqual([NOT_AMOUNT, true]);
  });
});

describe('MoneyInput: a signed amount (a supplement)', () => {
  it('reads a discount with its sign and rewrites it in the page format', async () => {
    const s = await setup({ money: EUR, signed: true }, 'es');
    await s.type('-0.5');
    await s.leave();
    expect([s.model.value, s.errorText()]).toEqual(['-0,50', undefined]);
    await s.type('+1,00 €');
    await s.leave();
    expect([s.model.value, s.errorText()]).toEqual(['1,00', undefined]);
  });

  it('what is not an amount tells how to write a discount', async () => {
    const s = await setup({ money: EUR, signed: true, modelValue: '--2', showError: true });
    expect(s.errorText()).toBe(NOT_AMOUNT_SIGNED);
  });

  it("a ± button turns a supplement into a discount and back: a phone's decimal keyboard has no minus", async () => {
    const s = await setup({ money: EUR, signed: true, modelValue: '1,50' }, 'es');
    expect([s.signButton()?.getAttribute('aria-label'), s.signButton()?.getAttribute('type')]).toEqual([
      'Cambiar el signo: en negativo es un descuento',
      'button',
    ]);
    const press = async () => {
      s.sign()?.click();
      await settle();
    };
    await press();
    expect(s.model.value).toBe('-1,50');
    await press();
    expect(s.model.value).toBe('1,50');
    await s.wrapper.setProps({ modelValue: '+1,00 €' });
    await press();
    expect(s.model.value).toBe('-1,00 €');
    await s.wrapper.setProps({ modelValue: '−2' });
    await press();
    expect(s.model.value).toBe('2');
    await s.wrapper.setProps({ modelValue: '' });
    await press();
    expect(s.model.value).toBe('-');
  });

  it('a disabled field’s ± button changes nothing', async () => {
    const s = await setup({ money: EUR, signed: true, modelValue: '1,50', disabled: true });
    s.sign()?.click();
    await settle();
    expect(s.model.value).toBe('1,50');
  });
});
