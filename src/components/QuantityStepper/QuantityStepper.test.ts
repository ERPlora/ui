// QuantityStepper: one less, the figure and one more, for how many of something (a line of a check, a dish of an
// order, an option picked twice). It only says what was asked; the figure shows what the page keeps, so a refused
// quantity puts the field back. Whole units unless `decimals`, where a weight is typed in the reader's language.
import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';

import { createShellI18n } from '../../shell/i18n';
import QuantityStepper from './QuantityStepper.vue';

type Control = HTMLElement & { disabled?: boolean };

async function settle(): Promise<void> {
  for (let i = 0; i < 4; i++) {
    await nextTick();
    await flushPromises();
  }
}

async function setup(props: Record<string, unknown> = {}, locale: 'en' | 'es' = 'en') {
  const wrapper = mount(QuantityStepper, {
    props: { quantity: 2, testid: 'qty', ...props },
    global: { plugins: [createShellI18n({ locale })] },
    attachTo: document.body,
  });
  await settle();
  const find = (id: string) => wrapper.find(`[data-testid="qty-${id}"]`);
  const field = () => find('field').element as HTMLInputElement;
  const click = async (id: string) => {
    find(id).element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
  };
  /** What a screen reader names a button by: Ionic moves its `aria-label` onto the button in its shadow. */
  const named = (id: string) => find(id).element.shadowRoot?.querySelector('button')?.getAttribute('aria-label');
  return { wrapper, find, field, click, named };
}

async function type(el: HTMLInputElement, value: string) {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  await settle();
}

const disabled = (el: Element) => (el as Control).disabled;

describe('QuantityStepper', () => {
  it('one more and one less ask a unit more or less, with their names for a screen reader', async () => {
    const m = await setup({ quantity: '1.000' });
    expect(m.find('plus').element.tagName.toLowerCase()).toBe('ion-button');
    await m.click('plus');
    await m.click('minus');
    expect(m.wrapper.emitted('change')).toEqual([['2'], ['0']]);
    expect([m.named('plus'), m.named('minus')]).toEqual(['One more', 'One less']);
    expect(m.find('field').attributes('aria-label')).toBe('Quantity');
  });

  it('speaks Spanish, and the page may name what it counts', async () => {
    const es = await setup({}, 'es');
    expect([es.named('minus'), es.named('plus')]).toEqual([
      'Uno menos',
      'Uno más',
    ]);
    const named = await setup({ decreaseLabel: 'One less Aioli', increaseLabel: 'One more Aioli', label: 'Aioli' });
    expect(named.named('minus')).toBe('One less Aioli');
    expect(named.find('field').attributes('aria-label')).toBe('Aioli');
  });

  it('waits at its floor and at its ceiling', async () => {
    const low = await setup({ quantity: 1, min: 1, max: 20 });
    expect([disabled(low.find('minus').element), disabled(low.find('plus').element)]).toEqual([true, false]);
    const high = await setup({ quantity: 20, min: 1, max: 20 });
    expect([disabled(high.find('minus').element), disabled(high.find('plus').element)]).toEqual([false, true]);
    await high.click('plus');
    expect(high.wrapper.emitted('change')).toBeUndefined();
  });

  it('takes whole units unless it is told decimals, and a typed figure outside its range goes back', async () => {
    const whole = await setup({ quantity: 2, min: 1, max: 20 });
    expect(whole.field().inputMode).toBe('numeric');
    await type(whole.field(), '2,5');
    await type(whole.field(), '21');
    await type(whole.field(), '0');
    expect(whole.wrapper.emitted('change')).toBeUndefined();
    expect(whole.field().value).toBe('2');
    await type(whole.field(), '7');
    expect(whole.wrapper.emitted('change')).toEqual([['7']]);
  });

  it('shows a weight in the reader’s language with its unit, and sends it as the server reads it', async () => {
    const units = await setup({ quantity: '2.000', unit: 'ud', decimals: true });
    expect(units.field().value).toBe('2');
    expect(units.find('unit').exists()).toBe(false);
    const weight = await setup({ quantity: '0.500', unit: 'kg', decimals: true }, 'es');
    expect(weight.field().value).toBe('0,5');
    expect(weight.find('unit').text()).toBe('kg');
    await type(weight.field(), '1,2505');
    await type(weight.field(), '0,5');
    expect(weight.wrapper.emitted('change')).toEqual([['1.2505']]);
  });

  // A field holds what a person types: four digits ungrouped («1500», where a screen writes «1.500»).
  it('shows a quantity of four digits ungrouped, as typed', async () => {
    const m = await setup({ quantity: '1500.000', decimals: true }, 'es');
    expect(m.field().value).toBe('1500');
  });

  it('once a write settles, the field shows the quantity the page keeps; what is not a quantity goes back', async () => {
    const m = await setup({ quantity: '0.532', unit: 'kg', decimals: true }, 'es');
    await type(m.field(), '1,25');
    await m.wrapper.setProps({ disabled: true });
    await m.wrapper.setProps({ disabled: false });
    expect(m.field().value).toBe('0,532');
    await type(m.field(), 'abc');
    expect(m.field().value).toBe('0,532');
    await m.wrapper.setProps({ quantity: '5.000' });
    expect(m.field().value).toBe('5');
  });

  it('can be locked while a write is in flight', async () => {
    const m = await setup({ disabled: true });
    expect([disabled(m.find('plus').element), disabled(m.find('minus').element), m.field().disabled]).toEqual([
      true,
      true,
      true,
    ]);
  });
});
