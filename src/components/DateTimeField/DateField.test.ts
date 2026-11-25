// DateField: a day of a form, `v-model` the ISO day (`YYYY-MM-DD`, '' or null for none). It shows the day in the
// app's language and picks it in Ionic's calendar, never the device's.
import { afterEach, describe, expect, it } from 'vitest';

import HubIcon from '../../shell/HubIcon.vue';
import { mountPicker } from './__tests__/pickers';
import DateField from './DateField.vue';
import PickerField from './PickerField.vue';

async function setup(props: Record<string, unknown> = {}, locale = 'en') {
  const s = await mountPicker(DateField, { modelValue: '2026-11-23', label: 'Day', testid: 'day', ...props }, locale);
  const shared = () => s.wrapper.getComponent(PickerField);
  const picked = () => s.wrapper.emitted('update:modelValue')?.map(([value]) => value);
  return { ...s, shared, picked };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('DateField', () => {
  it('shows the day in the numeric date of the app language', async () => {
    expect((await setup()).control().value).toBe('11/23/2026');
    expect((await setup({}, 'es')).control().value).toBe('23/11/2026');
  });

  it('shows nothing for no day', async () => {
    expect((await setup({ modelValue: '' })).control().value).toBe('');
    expect((await setup({ modelValue: null })).control().value).toBe('');
  });

  it('opens the calendar on its day, with its bounds and a calendar icon', async () => {
    const s = await setup({ min: '2026-11-01', max: '2026-12-31', required: true, name: 'day' });
    expect(s.shared().props()).toMatchObject({
      presentation: 'date',
      value: '2026-11-23',
      min: '2026-11-01',
      max: '2026-12-31',
      required: true,
      name: 'day',
      label: 'Day',
      testid: 'day',
    });
    expect(s.wrapper.findComponent(HubIcon).props('name')).toBe('ion:calendar-outline');
    await s.tap();
    expect(s.picker().props('presentation')).toBe('date');
  });

  it('without a last day of its own, the calendar offers the years ahead up to the end of 2100', async () => {
    for (const max of [undefined, '']) {
      const s = await setup({ max });
      await s.tap();
      expect(s.picker().props('max')).toBe('2100-12-31');
    }
  });

  it('a last day of its own, as a birthday up to today, stays the last one', async () => {
    const s = await setup({ max: '2026-11-25' });
    await s.tap();
    expect(s.picker().props('max')).toBe('2026-11-25');
  });

  it('keeps only the day of what the calendar answers, and Clear leaves it empty', async () => {
    const s = await setup();
    await s.tap();
    await s.choose('2026-12-01T10:15:00');
    await s.tap();
    await s.choose(undefined);
    expect(s.picked()).toEqual(['2026-12-01', '']);
  });

  it('passes its error, help and disabled state on', async () => {
    const s = await setup({ errorText: 'Closed that day.', helperText: 'Pick a day', disabled: true });
    expect(s.shared().props()).toMatchObject({ errorText: 'Closed that day.', helperText: 'Pick a day', disabled: true });
  });

  it('compact, as a control of a row of filters: it hands its placeholder over', async () => {
    const s = await setup({ compact: true, placeholder: 'From', modelValue: '' });
    expect(s.shared().props()).toMatchObject({ compact: true, placeholder: 'From', label: 'Day' });
  });

  it('a new day from the page is shown at once', async () => {
    const s = await setup();
    await s.wrapper.setProps({ modelValue: '2027-01-05' });
    expect(s.control().value).toBe('01/05/2027');
  });
});
