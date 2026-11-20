import { afterEach, describe, expect, it } from 'vitest';

import { COUNTRIES, field, key, mountCombo, native, options, popover, PopoverStub, resetAfterTest, settle, typeIn, type El, type Wrapper } from './__tests__/combo';

afterEach(resetAfterTest);

// On a tablet, choosing «Restaurant — food · 10%» with a finger left the field focused and the
// on-screen keyboard up, and the first tap on the form's Save did not save. A choice made with a finger (or
// a pen) lets go of the focus, so the keyboard goes away (MUI Autocomplete's `blurOnSelect="touch"`); a
// mouse or the keyboard keep it in the field, to go on with Tab.
describe('Combo: a choice made with a finger', () => {
  /** Opens the list, presses the option at `index` with `pointerType` and lets go (the click). */
  async function chooseWith(w: Wrapper, pointerType: string, index = 1) {
    native(w).focus();
    await field(w).trigger('click');
    await settle();
    const option = options(w)[index].element;
    option.dispatchEvent(new PointerEvent('pointerdown', { pointerType, bubbles: true, cancelable: true }));
    option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    option.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await settle();
  }
  /** A boolean, not the element: a failing `toBe(element)` serializes the whole happy-dom window. */
  const hasFocus = (w: Wrapper): boolean => document.activeElement === native(w);
  /** What Ionic 8 does once a popover is gone (overlays.ts, restoreElementFocus): if nothing has the
   *  focus, it gives it back to what had it when the popover showed — the field. */
  async function ionicGivesTheFocusBack(w: Wrapper) {
    w.getComponent(PopoverStub).vm.$emit('didDismiss');
    await Promise.resolve();
    if (document.activeElement === null || document.activeElement === document.body) native(w).focus();
    await settle();
  }

  it.each(['touch', 'pen'])('chooses the option and lets go of the focus, so the keyboard goes away (%s)', async (pointerType) => {
    const w = mountCombo();
    await settle();
    await chooseWith(w, pointerType);
    expect(w.emitted('update:modelValue')).toEqual([[COUNTRIES[1]]]);
    expect((field(w).element as El).value).toBe('Francia');
    expect(popover(w).exists()).toBe(false);
    expect(hasFocus(w), 'the field has the focus').toBe(false);
  });

  it('with a mouse the focus stays in the field', async () => {
    const w = mountCombo();
    await settle();
    await chooseWith(w, 'mouse');
    expect(w.emitted('update:modelValue')).toEqual([[COUNTRIES[1]]]);
    expect(hasFocus(w), 'the field has the focus').toBe(true);
  });

  it('with the keyboard (Enter) the focus stays in the field', async () => {
    const w = mountCombo();
    await settle();
    native(w).focus();
    await typeIn(w, 'port');
    await key(w, 'Enter');
    expect(w.emitted('update:modelValue')).toEqual([[COUNTRIES[2]]]);
    expect(hasFocus(w), 'the field has the focus').toBe(true);
  });

  it('a finger choosing «Create …» lets go of the focus too', async () => {
    const w = mountCombo({ allowCreate: true });
    await settle();
    native(w).focus();
    await typeIn(w, 'Italia');
    const create = popover(w).get('[data-testid="country-create"]').element;
    create.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true, cancelable: true }));
    create.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await settle();
    expect(w.emitted('create')).toEqual([['Italia']]);
    expect(hasFocus(w), 'the field has the focus').toBe(false);
  });

  it('Ionic giving the focus back once the list is gone does not bring the keyboard back', async () => {
    const w = mountCombo();
    await settle();
    await chooseWith(w, 'touch');
    await ionicGivesTheFocusBack(w);
    expect(hasFocus(w), 'the field has the focus').toBe(false);
  });

  it('nor does the field taking it back as Ionic finishes showing the list (a quick finger)', async () => {
    const w = mountCombo();
    await settle();
    await chooseWith(w, 'touch');
    w.getComponent(PopoverStub).vm.$emit('didPresent');
    await settle();
    expect(hasFocus(w), 'the field has the focus').toBe(false);
  });

  it('once the list is gone, the field takes the focus again as always', async () => {
    const w = mountCombo();
    await settle();
    await chooseWith(w, 'touch');
    await ionicGivesTheFocusBack(w);
    await new Promise((resolve) => setTimeout(resolve, 0));
    native(w).focus();
    expect(hasFocus(w), 'the field has the focus').toBe(true);
  });

  it('a finger counts for its own click only: a later click no press started (a screen reader’s) keeps the focus', async () => {
    const w = mountCombo();
    await settle();
    await chooseWith(w, 'touch');
    await ionicGivesTheFocusBack(w);
    await new Promise((resolve) => setTimeout(resolve, 0));
    native(w).focus();
    await field(w).trigger('click');
    await settle();
    options(w)[2].element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await settle();
    expect(w.emitted('update:modelValue')).toEqual([[COUNTRIES[1]], [COUNTRIES[2]]]);
    expect(hasFocus(w), 'the field has the focus').toBe(true);
  });

  it('a touch on the field while the list is still closing takes the focus at once', async () => {
    const w = mountCombo();
    await settle();
    await chooseWith(w, 'touch');
    field(w).element.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true, cancelable: true }));
    native(w).focus();
    expect(hasFocus(w), 'the field has the focus').toBe(true);
  });
});
