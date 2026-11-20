import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { COUNTRIES, field, mountCombo, optionLabels, popover, pressFromPage, resetAfterTest, settle, typeIn, type El } from './__tests__/combo';
import type { ComboOption } from './types';

afterEach(resetAfterTest);

describe('Combo: asking the server (search)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  it('waits 150 ms after the last key, asks once with the text, and paints the answer', async () => {
    const search = vi.fn((query: string) => Promise.resolve(COUNTRIES.filter((c) => c.label.toLowerCase().includes(query))));
    const w = mountCombo({ options: undefined, search });
    await settle();
    await typeIn(w, 'f');
    await typeIn(w, 'fr');
    vi.advanceTimersByTime(149);
    expect(search).not.toHaveBeenCalled();
    expect(popover(w).find('[data-testid="country-loading"]').exists()).toBe(true);
    expect(popover(w).get('[role="listbox"]').attributes('aria-busy')).toBe('true');
    vi.advanceTimersByTime(1);
    await settle();
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith('fr');
    expect(optionLabels(w)).toEqual(['Francia']);
    expect(popover(w).find('[data-testid="country-loading"]').exists()).toBe(false);
  });

  it('opening asks with an empty text (the first page of the server)', async () => {
    const search = vi.fn(() => Promise.resolve(COUNTRIES.slice(0, 2)));
    const w = mountCombo({ options: undefined, search });
    await settle();
    await field(w).trigger('click');
    vi.advanceTimersByTime(150);
    await settle();
    expect(search).toHaveBeenCalledWith('');
    expect(optionLabels(w)).toEqual(['España', 'Francia']);
  });

  it('an older answer that arrives late never replaces a newer one', async () => {
    let answerFirst: (options: ComboOption[]) => void = () => {};
    const search = vi
      .fn<(query: string) => Promise<ComboOption[]>>()
      .mockImplementationOnce(() => new Promise((resolve) => (answerFirst = resolve)))
      .mockImplementationOnce(() => Promise.resolve([COUNTRIES[2]]));
    const w = mountCombo({ options: undefined, search });
    await settle();
    await typeIn(w, 'p');
    vi.advanceTimersByTime(150);
    await typeIn(w, 'po');
    vi.advanceTimersByTime(150);
    await settle();
    answerFirst([COUNTRIES[0]]);
    await settle();
    expect(optionLabels(w)).toEqual(['Portugal']);
  });

  it('a failed search says so and offers to retry', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const search = vi.fn<(query: string) => Promise<ComboOption[]>>().mockRejectedValueOnce(new Error('503')).mockResolvedValueOnce([COUNTRIES[3]]);
    const w = mountCombo({ options: undefined, search });
    await settle();
    await typeIn(w, 'al');
    vi.advanceTimersByTime(150);
    await settle();
    expect(popover(w).get('[data-testid="country-error"]').text()).toContain('Could not load the options');
    expect(error).toHaveBeenCalled();
    await popover(w).get('[data-testid="country-retry"]').trigger('click');
    vi.advanceTimersByTime(150);
    await settle();
    expect(search).toHaveBeenLastCalledWith('al');
    expect(optionLabels(w)).toEqual(['Alemania']);
  });

  // A role typed and Enter before the server answered saved the staff member's sheet with the old role.
  it('Enter while the search is loading stays here (never submits the form) and chooses nothing, not even when the answer comes', async () => {
    let answerNow: (options: ComboOption[]) => void = () => {};
    const search = vi.fn(() => new Promise<ComboOption[]>((resolve) => (answerNow = resolve)));
    const w = mountCombo({ modelValue: COUNTRIES[3], options: undefined, search });
    await settle();
    await typeIn(w, 'sty');
    // Within the 150 ms before asking, and then with the question in flight.
    expect(await pressFromPage(w, 'Enter')).toEqual({ prevented: true, reachedPage: false });
    vi.advanceTimersByTime(150);
    await settle();
    expect(search).toHaveBeenCalledWith('sty');
    expect(popover(w).find('[data-testid="country-loading"]').exists()).toBe(true);
    expect(await pressFromPage(w, 'Enter')).toEqual({ prevented: true, reachedPage: false });
    expect(popover(w).exists()).toBe(true);
    expect((field(w).element as El).value).toBe('sty');
    // The answer is shown, its first option highlighted, but nothing is chosen behind the person's back.
    answerNow([COUNTRIES[0], COUNTRIES[1]]);
    await settle();
    expect(optionLabels(w)).toEqual(['España', 'Francia']);
    expect(w.emitted('update:modelValue')).toBeUndefined();
    // Enter on what the person now sees takes the highlighted option, and still not the form.
    expect(await pressFromPage(w, 'Enter')).toEqual({ prevented: true, reachedPage: false });
    expect(w.emitted('update:modelValue')).toEqual([[COUNTRIES[0]]]);
    expect(popover(w).exists()).toBe(false);
  });

  it('Enter on a failed search stays here too: no submit, the error and its Retry stay', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const search = vi.fn<(query: string) => Promise<ComboOption[]>>().mockRejectedValue(new Error('503'));
    const w = mountCombo({ options: undefined, search });
    await settle();
    await typeIn(w, 'al');
    vi.advanceTimersByTime(150);
    await settle();
    expect(popover(w).find('[data-testid="country-error"]').exists()).toBe(true);
    expect(await pressFromPage(w, 'Enter')).toEqual({ prevented: true, reachedPage: false });
    expect(popover(w).find('[data-testid="country-retry"]').exists()).toBe(true);
    expect(w.emitted('update:modelValue')).toBeUndefined();
  });
});
