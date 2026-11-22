// DateTimeField: a day and a time of a form as one value, `v-model` `YYYY-MM-DDTHH:MM` ('' or null for none), picked in
// a DateField and a TimeField side by side. Until both hold something the value is '', as a half-typed native field.
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';

import { IonPopoverStub } from '../../shell/__tests__/ionPopoverStub';
import { createShellI18n } from '../../shell/i18n';
import { settle } from './__tests__/pickers';
import DateField from './DateField.vue';
import DateTimeField from './DateTimeField.vue';
import TimeField from './TimeField.vue';

async function setup(props: Record<string, unknown> = {}, locale = 'en') {
  const wrapper = mount(DateTimeField, {
    props: { modelValue: '2026-11-23T09:30', label: 'Clock in', testid: 'clock-in', ...props },
    attachTo: document.body,
    global: { plugins: [createShellI18n({ locale })], stubs: { IonPopover: IonPopoverStub } },
  });
  await settle();
  const day = () => wrapper.getComponent(DateField);
  const time = () => wrapper.getComponent(TimeField);
  const sent = () => wrapper.emitted('update:modelValue')?.map(([value]) => value);
  return { wrapper, day, time, sent };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('DateTimeField', () => {
  it('splits its value into a day and a time, the day under its label and the time under the app’s word', async () => {
    const s = await setup();
    expect(s.day().props()).toMatchObject({ modelValue: '2026-11-23', label: 'Clock in', testid: 'clock-in-date' });
    expect(s.time().props()).toMatchObject({ modelValue: '09:30', label: 'Time', testid: 'clock-in-time' });
    expect((await setup({}, 'es')).time().props('label')).toBe('Hora');
    const group = s.wrapper.get('[data-testid="clock-in"]');
    expect([group.attributes('role'), group.attributes('aria-label')]).toEqual(['group', 'Clock in']);
  });

  it('reads a value with seconds, and none as two empty fields', async () => {
    expect((await setup({ modelValue: '2026-11-23T09:30:15' })).time().props('modelValue')).toBe('09:30');
    const none = await setup({ modelValue: null });
    expect([none.day().props('modelValue'), none.time().props('modelValue')]).toEqual(['', '']);
  });

  it('sends the day and the time together once both are picked', async () => {
    const s = await setup({ modelValue: '' });
    s.day().vm.$emit('update:modelValue', '2026-12-01');
    await settle();
    s.time().vm.$emit('update:modelValue', '18:05');
    await settle();
    s.day().vm.$emit('update:modelValue', '2026-12-02');
    await settle();
    expect(s.sent()).toEqual(['', '2026-12-01T18:05', '2026-12-02T18:05']);
    expect(s.day().props('modelValue')).toBe('2026-12-02');
  });

  it('a field cleared leaves the value empty, and keeps what the other holds', async () => {
    const s = await setup();
    s.time().vm.$emit('update:modelValue', '');
    await settle();
    expect(s.sent()).toEqual(['']);
    expect(s.day().props('modelValue')).toBe('2026-11-23');
  });

  it('a new value from the page shows at once; its own empty value while half picked keeps the half', async () => {
    const s = await setup({ modelValue: '' });
    await s.wrapper.setProps({ modelValue: '2027-01-05T07:00' });
    expect([s.day().props('modelValue'), s.time().props('modelValue')]).toEqual(['2027-01-05', '07:00']);
    s.time().vm.$emit('update:modelValue', '');
    await settle();
    await s.wrapper.setProps({ modelValue: '' });
    expect([s.day().props('modelValue'), s.time().props('modelValue')]).toEqual(['2027-01-05', '']);
  });

  it('hands its state to both fields, and its error and help under the day', async () => {
    const s = await setup({ required: true, disabled: true, name: 'clock_in_at', minuteStep: 5, errorText: 'Too late.', helperText: 'At the business' });
    expect(s.day().props()).toMatchObject({ required: true, disabled: true, name: 'clock_in_at', errorText: 'Too late.', helperText: 'At the business' });
    expect(s.time().props()).toMatchObject({ required: true, disabled: true, name: 'clock_in_at', minuteStep: 5 });
    expect([s.time().props('errorText'), s.time().props('helperText')]).toEqual([undefined, undefined]);
  });
});
