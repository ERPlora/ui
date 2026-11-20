import { afterEach, describe, expect, it, vi } from 'vitest';

import HubIcon from '../../shell/HubIcon.vue';
import { COUNTRIES, field, key, labelText, mountCombo, native, optionLabels, options, popover, PopoverStub, pressFromPage, resetAfterTest, settle, typeIn, type El } from './__tests__/combo';

afterEach(resetAfterTest);

describe('Combo: the field', () => {
  it('is an ion-input in md with the outline fill, its label floating, and the chosen option as its text', async () => {
    const w = mountCombo({ modelValue: COUNTRIES[0], placeholder: 'Pick a country' });
    await settle();
    const input = field(w).element as El;
    expect(field(w).attributes('mode')).toBe('md');
    expect(input.fill).toBe('outline');
    expect(input.label).toBe('Country');
    expect(input.labelPlacement).toBe('floating');
    expect(input.placeholder).toBe('Pick a country');
    expect(input.value).toBe('España');
  });

  it('hands its name to its ion-input, so the form around it can tell which field was corrected', async () => {
    const w = mountCombo({ name: 'country_code' });
    await settle();
    expect((field(w).element as El).name).toBe('country_code');
  });

  it('is a combobox for assistive tech: role, list autocomplete, the listbox it controls, collapsed', async () => {
    const w = mountCombo();
    await settle();
    const input = native(w);
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.getAttribute('aria-controls')).toMatch(/^ep-combo-.+-listbox$/);
    expect(input.hasAttribute('aria-activedescendant')).toBe(false);
  });

  it('shows the error text of the form under the field', async () => {
    const w = mountCombo({ errorText: 'Pick a country' });
    await settle();
    expect((field(w).element as El).errorText).toBe('Pick a country');
    // Ionic paints the error text only on an invalid, touched field.
    expect(field(w).classes()).toEqual(expect.arrayContaining(['ion-invalid', 'ion-touched']));
    const fine = mountCombo();
    await settle();
    expect(field(fine).classes()).not.toContain('ion-invalid');
  });
});

describe('Combo: static options', () => {
  it('a click opens every option, in order, each with its hint', async () => {
    const w = mountCombo();
    await settle();
    expect(popover(w).exists()).toBe(false);
    await field(w).trigger('click');
    await settle();
    expect(popover(w).exists()).toBe(true);
    expect(optionLabels(w)).toEqual(['España', 'Francia', 'Portugal', 'Alemania']);
    expect(options(w)[0].get('ion-label p').element.innerHTML.trim()).toBe('ES');
    expect(native(w).getAttribute('aria-expanded')).toBe('true');
    const listbox = popover(w).get('[role="listbox"]');
    expect(listbox.attributes('id')).toBe(native(w).getAttribute('aria-controls'));
    expect(listbox.attributes('aria-label')).toBe('Country');
  });

  it('opens under the field, as wide as it, without taking the focus from it', async () => {
    const w = mountCombo();
    await settle();
    await field(w).trigger('click');
    await settle();
    const stub = w.getComponent(PopoverStub);
    expect((stub.props('event') as { target?: Element }).target).toBe(field(w).element);
    const attrs = popover(w).attributes();
    expect(attrs.side).toBe('bottom');
    expect(attrs.alignment).toBe('start');
    expect(attrs.size).toBe('cover');
    expect(attrs['keyboard-close']).toBe('false');
    expect(attrs['focus-trap']).toBe('false');
    expect(attrs['show-backdrop']).toBe('false');
  });

  it('typing filters by «contains», ignoring case and accents, on the label and the hint', async () => {
    const w = mountCombo();
    await settle();
    await typeIn(w, 'espa');
    expect(optionLabels(w)).toEqual(['España']);
    await typeIn(w, 'AN');
    expect(optionLabels(w)).toEqual(['España', 'Francia', 'Alemania']);
    await typeIn(w, 'pt');
    expect(optionLabels(w)).toEqual(['Portugal']);
  });

  it('nothing found: says so (its own text when given)', async () => {
    const w = mountCombo();
    await settle();
    await typeIn(w, 'zz');
    expect(options(w)).toHaveLength(0);
    expect(popover(w).get('[data-testid="country-empty"]').text()).toBe('No matches');
    const own = mountCombo({ emptyLabel: 'No such country' });
    await settle();
    await typeIn(own, 'zz');
    expect(popover(own).get('[data-testid="country-empty"]').text()).toBe('No such country');
  });

  it('a choice and its Clear say `input` to the form around them, as typing does (FormModal hears it)', async () => {
    const w = mountCombo({ clearable: true });
    await settle();
    const heard = vi.fn();
    w.element.parentElement?.addEventListener('input', heard);
    await field(w).trigger('click');
    await settle();
    await options(w)[0].trigger('click');
    await settle();
    expect(heard).toHaveBeenCalledTimes(1);
    await w.setProps({ modelValue: COUNTRIES[0] });
    await settle();
    await w.get('[data-testid="country-clear"]').trigger('click');
    await settle();
    expect(heard).toHaveBeenCalledTimes(2);
    w.element.parentElement?.removeEventListener('input', heard);
  });

  it('a click on an option chooses it: v-model, its label in the field, closed', async () => {
    const w = mountCombo();
    await settle();
    await typeIn(w, 'port');
    await options(w)[0].trigger('click');
    await settle();
    expect(w.emitted('update:modelValue')).toEqual([[COUNTRIES[2]]]);
    expect((field(w).element as El).value).toBe('Portugal');
    expect(popover(w).exists()).toBe(false);
    expect(native(w).getAttribute('aria-expanded')).toBe('false');
  });

  // Measured in Chrome: Ionic 8's present() blurs the focused element before any overlay shows, so
  // the next keys went to <body>. The field takes the focus back as the popover is about to show.
  it('keeps the focus in the field when Ionic presents the popover (it blurs whatever had it)', async () => {
    const w = mountCombo();
    await settle();
    native(w).focus();
    await field(w).trigger('click');
    await settle();
    native(w).blur();
    expect(document.activeElement).not.toBe(native(w));
    w.getComponent(PopoverStub).vm.$emit('willPresent');
    await settle();
    expect(document.activeElement).toBe(native(w));
  });

  it('a press on an option keeps the focus in the field (the click still lands)', async () => {
    const w = mountCombo();
    await settle();
    await field(w).trigger('click');
    await settle();
    const press = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    options(w)[1].element.dispatchEvent(press);
    expect(press.defaultPrevented).toBe(true);
  });

  it('follows the v-model the page sets', async () => {
    const w = mountCombo({ modelValue: null });
    await settle();
    await w.setProps({ modelValue: COUNTRIES[1] });
    await settle();
    expect((field(w).element as El).value).toBe('Francia');
  });
});

describe('Combo: the keyboard', () => {
  it('ArrowDown opens; the arrows move the highlight (wrapping), told by aria-activedescendant', async () => {
    const w = mountCombo();
    await settle();
    await key(w, 'ArrowDown');
    expect(popover(w).exists()).toBe(true);
    const active = () => options(w).findIndex((o) => o.classes().includes('combo__option--active'));
    expect(active()).toBe(0);
    expect(native(w).getAttribute('aria-activedescendant')).toBe(options(w)[0].attributes('id'));
    expect(options(w)[0].attributes('aria-selected')).toBe('true');
    expect(options(w)[1].attributes('aria-selected')).toBe('false');
    await key(w, 'ArrowDown');
    expect(active()).toBe(1);
    await key(w, 'ArrowUp');
    await key(w, 'ArrowUp');
    expect(active()).toBe(3);
    await key(w, 'ArrowDown');
    expect(active()).toBe(0);
    expect(native(w).getAttribute('aria-activedescendant')).toBe(options(w)[0].attributes('id'));
  });

  it('Enter chooses the highlighted option (the first match while typing), and does not submit the form around it', async () => {
    const w = mountCombo();
    await settle();
    await typeIn(w, 'a');
    await key(w, 'ArrowDown');
    const outside = vi.fn();
    document.body.addEventListener('keydown', outside);
    await key(w, 'Enter');
    expect(outside).not.toHaveBeenCalled();
    expect(w.emitted('update:modelValue')).toEqual([[COUNTRIES[1]]]);
    expect(popover(w).exists()).toBe(false);
    // Closed, Enter is the form's again.
    await key(w, 'Enter');
    expect(outside).toHaveBeenCalledTimes(1);
    document.body.removeEventListener('keydown', outside);
  });

  // An open list with nothing to choose let Enter through, and the FormModal around it saved. Open, Enter is
  // always the combo's (WAI-ARIA APG, Headless UI, React Aria, Downshift, Tom Select…); with no option to take,
  // it does nothing and the list stays.
  it('Enter on an open list with nothing to choose (no matches) stays here: no submit, the list stays open', async () => {
    const w = mountCombo({ modelValue: COUNTRIES[0] });
    await settle();
    await typeIn(w, 'zz');
    expect(popover(w).find('[data-testid="country-empty"]').exists()).toBe(true);
    expect(await pressFromPage(w, 'Enter')).toEqual({ prevented: true, reachedPage: false });
    expect(popover(w).exists()).toBe(true);
    expect((field(w).element as El).value).toBe('zz');
    expect(w.emitted('update:modelValue')).toBeUndefined();
    expect(w.emitted('create')).toBeUndefined();
  });

  it('Enter on a closed list is the form’s: it reaches the page around the combo, untouched', async () => {
    const w = mountCombo({ modelValue: COUNTRIES[0] });
    await settle();
    expect(popover(w).exists()).toBe(false);
    expect(await pressFromPage(w, 'Enter')).toEqual({ prevented: false, reachedPage: true });
    expect(popover(w).exists()).toBe(false);
    expect(w.emitted('update:modelValue')).toBeUndefined();
  });

  it('Escape closes and puts back the chosen option’s label; it does not reach the dialog around it', async () => {
    const w = mountCombo({ modelValue: COUNTRIES[0] });
    await settle();
    await typeIn(w, 'fra');
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    const outside = vi.fn();
    document.body.addEventListener('keydown', outside);
    native(w).dispatchEvent(escape);
    await settle();
    expect(escape.defaultPrevented).toBe(true);
    expect(outside).not.toHaveBeenCalled();
    expect(popover(w).exists()).toBe(false);
    expect((field(w).element as El).value).toBe('España');
    expect(w.emitted('update:modelValue')).toBeUndefined();
  });

  it('Tab closes it and moves on (puts back the chosen label)', async () => {
    const w = mountCombo({ modelValue: COUNTRIES[0] });
    await settle();
    await typeIn(w, 'fra');
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    native(w).dispatchEvent(tab);
    await settle();
    expect(tab.defaultPrevented).toBe(false);
    expect(popover(w).exists()).toBe(false);
    expect((field(w).element as El).value).toBe('España');
  });

  it('a dismissal of the popover (a tap outside) closes it the same way', async () => {
    const w = mountCombo({ modelValue: COUNTRIES[0] });
    await settle();
    await typeIn(w, 'fra');
    w.getComponent(PopoverStub).vm.$emit('didDismiss');
    await settle();
    expect(popover(w).exists()).toBe(false);
    expect((field(w).element as El).value).toBe('España');
  });
});

describe('Combo: clearable', () => {
  it('a Clear button while something is chosen: empties the v-model and the field', async () => {
    const w = mountCombo({ modelValue: COUNTRIES[0] });
    await settle();
    const clear = w.get('[data-testid="country-clear"]');
    expect(clear.isVisible()).toBe(true);
    expect(clear.attributes('slot')).toBe('end');
    // ion-button hands its aria-label to its native button.
    expect(clear.element.shadowRoot?.querySelector('button')?.getAttribute('aria-label')).toBe('Clear');
    expect(clear.getComponent(HubIcon).props('name')).toBe('ion:close-circle-outline');
    await clear.trigger('click');
    await settle();
    expect(w.emitted('update:modelValue')).toEqual([[null]]);
    expect((field(w).element as El).value).toBe('');
  });

  it('no Clear without a choice, when not clearable, or disabled', async () => {
    for (const props of [{ modelValue: null }, { modelValue: COUNTRIES[0], clearable: false }, { modelValue: COUNTRIES[0], disabled: true }]) {
      const w = mountCombo(props);
      await settle();
      expect(w.get('[data-testid="country-clear"]').isVisible(), JSON.stringify(props)).toBe(false);
    }
  });

  it('disabled: the field is disabled and nothing opens', async () => {
    const w = mountCombo({ disabled: true });
    await settle();
    expect((field(w).element as El).disabled).toBe(true);
    await field(w).trigger('click');
    await key(w, 'ArrowDown');
    expect(popover(w).exists()).toBe(false);
  });
});

describe('Combo: «Create …» (allowCreate)', () => {
  it('offers to create what was typed, last; choosing it emits create with the text and keeps it in the field', async () => {
    const w = mountCombo({ allowCreate: true });
    await settle();
    await typeIn(w, ' Andorra ');
    expect(options(w)).toHaveLength(1);
    const create = popover(w).get('[data-testid="country-create"]');
    expect(create.attributes('role')).toBe('option');
    expect(labelText(create.get('ion-label').element)).toBe('Create “Andorra”');
    await key(w, 'Enter');
    expect(w.emitted('create')).toEqual([['Andorra']]);
    expect(w.emitted('update:modelValue')).toBeUndefined();
    expect(popover(w).exists()).toBe(false);
    expect((field(w).element as El).value).toBe(' Andorra ');
  });

  it('not for an empty text nor one that names an option already', async () => {
    const w = mountCombo({ allowCreate: true });
    await settle();
    await typeIn(w, 'francia');
    expect(popover(w).find('[data-testid="country-create"]').exists()).toBe(false);
    await typeIn(w, '  ');
    expect(popover(w).find('[data-testid="country-create"]').exists()).toBe(false);
  });

  it('speaks Spanish', async () => {
    const w = mountCombo({ allowCreate: true }, 'es');
    await settle();
    await typeIn(w, 'Andorra');
    expect(labelText(popover(w).get('[data-testid="country-create"] ion-label').element)).toBe('Crear «Andorra»');
    await typeIn(w, 'zz-nada');
    const empty = mountCombo({}, 'es');
    await settle();
    await typeIn(empty, 'zz');
    expect(popover(empty).get('[data-testid="country-empty"]').text()).toBe('Sin coincidencias');
  });
});
