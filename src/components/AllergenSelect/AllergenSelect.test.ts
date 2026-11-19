import { IonCheckbox } from '@ionic/vue';
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';

import * as root from '../../index';
import * as components from '../index';
import AllergenSelect from './AllergenSelect.vue';
import { ALLERGEN_CODES, allergenName } from './allergens';
import * as entry from './index';

function selector(extra: Record<string, unknown> = {}) {
  return mount(AllergenSelect, {
    props: {
      modelValue: [],
      label: 'Allergens',
      helperText: 'Mark every allergen the product contains.',
      testid: 'product-allergens',
      ...extra,
    },
  });
}

afterEach(() => {
  document.documentElement.lang = 'en';
});

describe('AllergenSelect', () => {
  it('shows all fourteen names in list order, with none selected by default', () => {
    const wrapper = selector();
    const checkboxes = wrapper.findAllComponents(IonCheckbox);

    expect(checkboxes).toHaveLength(14);
    expect(checkboxes.map((checkbox) => checkbox.text())).toEqual(ALLERGEN_CODES.map((code) => allergenName(code, 'en')));
    expect(checkboxes.every((checkbox) => checkbox.props('checked') === false)).toBe(true);
    expect(wrapper.get('fieldset').attributes('aria-describedby')).toContain(wrapper.get('ion-note').attributes('id'));
  });

  it('marks and unmarks by name without losing the previous selection or its canonical order', async () => {
    const wrapper = selector({ modelValue: ['milk'] });
    const checkboxes = wrapper.findAllComponents(IonCheckbox);
    expect(checkboxes[6].props('checked')).toBe(true);

    await checkboxes[2].trigger('ionChange', { detail: { checked: true } });
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['egg', 'milk']]);

    await wrapper.setProps({ modelValue: ['egg', 'milk'] });
    await checkboxes[6].trigger('ionChange', { detail: { checked: false } });
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['egg']]);
  });

  it('uses the business language for every allergen name', async () => {
    document.documentElement.lang = 'es';
    const wrapper = selector();
    const checkboxes = wrapper.findAllComponents(IonCheckbox);

    expect(checkboxes.map((checkbox) => checkbox.text())).toEqual(ALLERGEN_CODES.map((code) => allergenName(code, 'es')));
    expect(checkboxes[7].text()).toBe('Frutos de cáscara');
  });

  it('names the group, associates its error and disables every checkbox when asked', () => {
    const wrapper = selector({ errorText: 'Choose a valid allergen.', disabled: true });
    const error = wrapper.get('.allergen-select__error');

    expect(wrapper.get('legend').text()).toBe('Allergens');
    expect(wrapper.get('fieldset').attributes('aria-describedby')).toContain(error.attributes('id'));
    expect(error.text()).toBe('Choose a valid allergen.');
    expect(wrapper.findAllComponents(IonCheckbox).every((checkbox) => checkbox.props('disabled') === true)).toBe(true);
  });

  it('is exported from its folder, the components barrel and the package root', () => {
    expect(entry.AllergenSelect).toBe(AllergenSelect);
    expect(components.AllergenSelect).toBe(AllergenSelect);
    expect(root.AllergenSelect).toBe(AllergenSelect);
  });
});
