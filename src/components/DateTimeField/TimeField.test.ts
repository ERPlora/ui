// TimeField: a time of a form, `v-model` `HH:MM` ('' or null for none). It shows the time on the clock of the app's
// language and picks it in Ionic's time wheel, never the device's.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import HubIcon from '../../shell/HubIcon.vue';
import { mountPicker } from './__tests__/pickers';
import PickerField from './PickerField.vue';
import TimeField from './TimeField.vue';

async function setup(props: Record<string, unknown> = {}, locale = 'en') {
  const s = await mountPicker(TimeField, { modelValue: '14:30', label: 'Time', testid: 'time', ...props }, locale);
  const shared = () => s.wrapper.getComponent(PickerField);
  const picked = () => s.wrapper.emitted('update:modelValue')?.map(([value]) => value);
  return { ...s, shared, picked };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 21, 8, 0));
});

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('TimeField', () => {
  it('shows the time on the clock of the app language', async () => {
    expect((await setup()).control().value).toMatch(/^02:30\sPM$/);
    expect((await setup({}, 'es')).control().value).toBe('14:30');
  });

  it('shows nothing for no time', async () => {
    expect((await setup({ modelValue: '' })).control().value).toBe('');
    expect((await setup({ modelValue: null })).control().value).toBe('');
  });

  it('opens the wheel on its time with its bounds, on today, every `minuteStep` minutes and with a clock icon', async () => {
    const s = await setup({ min: '09:00', max: '18:00', minuteStep: 15, required: true, name: 'start' });
    expect(s.shared().props()).toMatchObject({
      presentation: 'time',
      value: '2026-11-21T14:30',
      min: '2026-11-21T09:00',
      max: '2026-11-21T18:00',
      minuteValues: '0,15,30,45',
      required: true,
      name: 'start',
      label: 'Time',
      testid: 'time',
    });
    expect(s.wrapper.findComponent(HubIcon).props('name')).toBe('ion:time-outline');
  });

  it('without bounds nor step, every minute of the day', async () => {
    const s = await setup({ modelValue: '' });
    expect(s.shared().props()).toMatchObject({ value: '', min: undefined, max: undefined, minuteValues: undefined });
  });

  it('keeps only the time of what the wheel answers, and Clear leaves it empty', async () => {
    const s = await setup();
    await s.tap();
    await s.choose('2026-11-21T09:15:00');
    await s.tap();
    await s.choose(undefined);
    expect(s.picked()).toEqual(['09:15', '']);
  });

  it('passes its error, help and disabled state on', async () => {
    const s = await setup({ errorText: 'That time does not exist.', helperText: 'Local time', disabled: true });
    expect(s.shared().props()).toMatchObject({ errorText: 'That time does not exist.', helperText: 'Local time', disabled: true });
  });
});
