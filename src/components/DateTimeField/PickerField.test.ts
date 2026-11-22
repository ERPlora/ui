// The field DateField and TimeField share: read-only and outlined like the other fields of a form, showing the value
// as the person reads it, and opening Ionic's own picker (ion-datetime) in a popover anchored to it.
import { afterEach, describe, expect, it } from 'vitest';

import HubIcon from '../../shell/HubIcon.vue';
import { type Control, mountPicker } from './__tests__/pickers';
import PickerField from './PickerField.vue';

const BASE = {
  label: 'Day',
  testid: 'day',
  text: '11/23/2026',
  icon: 'ion:calendar-outline',
  presentation: 'date',
  value: '2026-11-23',
};

function setup(props: Record<string, unknown> = {}, locale = 'en') {
  return mountPicker(PickerField, { ...BASE, ...props }, locale);
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('PickerField: closed', () => {
  it('is an outlined md field with its label and the value as read, which no keyboard edits', async () => {
    const s = await setup({ name: 'start' });
    const field = s.input();
    expect([field.props('label'), field.props('fill'), field.attributes('mode'), field.props('labelPlacement')]).toEqual([
      'Day',
      'outline',
      'md',
      'floating',
    ]);
    expect([s.control().value, s.control().readonly, s.control().name]).toEqual(['11/23/2026', true, 'start']);
    // Ionic moves the host's `aria-*` onto its native input, where a screen reader meets it.
    expect(s.control().querySelector('input')?.getAttribute('aria-haspopup')).toBe('dialog');
    const icon = s.wrapper.findComponent(HubIcon);
    expect([icon.props('name'), icon.attributes('slot'), icon.attributes('aria-hidden')]).toEqual(['ion:calendar-outline', 'end', 'true']);
    expect(s.isOpen()).toBe(false);
  });

  it('says the error under it, marked as Ionic paints it, and its help otherwise', async () => {
    const s = await setup({ helperText: 'The first day' });
    expect([s.control().helperText, s.field().classes()]).toEqual(['The first day', expect.not.arrayContaining(['ion-invalid'])]);
    await s.wrapper.setProps({ errorText: 'That day is closed.' });
    expect(s.control().errorText).toBe('That day is closed.');
    expect(s.field().classes()).toEqual(expect.arrayContaining(['ion-invalid', 'ion-touched']));
  });
});

describe('PickerField: opening the picker', () => {
  it('a tap opens ion-datetime in a popover anchored to the field', async () => {
    const s = await setup();
    await s.tap();
    expect(s.isOpen()).toBe(true);
    const anchor = s.popover().props('event') as { target?: Element } | undefined;
    expect(anchor?.target).toBe(s.field().element);
    expect(s.picker().props()).toMatchObject({ presentation: 'date', value: '2026-11-23', locale: 'en', firstDayOfWeek: 0 });
  });

  it('Enter, Space and the down arrow open it from the keyboard; Tab and letters do not', async () => {
    for (const key of ['Enter', ' ', 'ArrowDown']) {
      const s = await setup();
      const event = await s.press(key);
      expect([key, s.isOpen(), event.defaultPrevented]).toEqual([key, true, true]);
      s.wrapper.unmount();
    }
    const s = await setup();
    await s.press('Tab');
    await s.press('a');
    expect(s.isOpen()).toBe(false);
  });

  it('a disabled field opens nothing', async () => {
    const s = await setup({ disabled: true });
    expect(s.control().disabled).toBe(true);
    await s.tap();
    await s.press('Enter');
    expect(s.isOpen()).toBe(false);
  });

  it('offers Done, Cancel and Clear in the app language, Clear only when the field may be empty', async () => {
    const s = await setup();
    await s.tap();
    expect(s.picker().props()).toMatchObject({
      showDefaultButtons: true,
      showClearButton: true,
      doneText: 'Done',
      cancelText: 'Cancel',
      clearText: 'Clear',
    });
    const required = await setup({ required: true });
    expect(required.control().required).toBe(true);
    await required.tap();
    expect(required.picker().props('showClearButton')).toBe(false);
  });

  it('in Spanish: its buttons, the calendar language and a week from Monday', async () => {
    const s = await setup({}, 'es');
    await s.tap();
    expect(s.picker().props()).toMatchObject({ doneText: 'Aceptar', cancelText: 'Cancelar', clearText: 'Borrar', locale: 'es', firstDayOfWeek: 1 });
  });

  it('hands the picker its bounds and its minutes', async () => {
    const bounds = { min: '2026-11-21T09:00', max: '2026-11-21T18:00' };
    const s = await setup({ presentation: 'time', value: '2026-11-21T10:00', ...bounds, minuteValues: '0,30' });
    await s.tap();
    expect(s.picker().props()).toMatchObject({ presentation: 'time', ...bounds, minuteValues: '0,30', preferWheel: true });
  });

  it('opens empty on no value', async () => {
    const s = await setup({ value: '' });
    await s.tap();
    expect((s.picker().element as Control).value).toBeUndefined();
  });
});

describe('PickerField: what the picker answers', () => {
  it('Done hands the value on and tells the form around it, as a typed field does', async () => {
    const s = await setup();
    const heard: Event[] = [];
    document.body.addEventListener('input', (event) => heard.push(event));
    await s.tap();
    await s.choose('2026-12-01T10:00:00');
    expect(s.wrapper.emitted('pick')).toEqual([['2026-12-01T10:00:00']]);
    expect(heard.map((event) => event.target)).toEqual([s.field().element]);
  });

  it('Clear empties the field and closes the picker', async () => {
    const s = await setup();
    await s.tap();
    await s.choose(undefined);
    expect(s.wrapper.emitted('pick')).toEqual([[null]]);
    expect(s.isOpen()).toBe(false);
  });

  it('once the popover is gone (Done, Cancel, outside, Escape) another tap opens it again', async () => {
    const s = await setup();
    await s.tap();
    s.popover().vm.$emit('didDismiss');
    await s.wrapper.vm.$nextTick();
    expect(s.isOpen()).toBe(false);
    expect(s.wrapper.emitted('pick')).toBeUndefined();
    await s.tap();
    expect(s.isOpen()).toBe(true);
  });
});
