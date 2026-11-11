// SettingsNumberField: a number field of a settings page, the one every «Settings» tab of the Hub had copied
// (hub#982; APPOINTMENT-F19, RESERVATION-F03, ONLINE_BOOKING-F07, STAFF-F22, TABLE-F08, KITCHEN-F26,
// ATTENDANCE-F04, SERVICE-F11, INVENTORY-F19): an outlined md number box with its floating label, painted from
// what useSettingsForm gives (the form, the refusal's messages and `set`), the field's name and the page's texts.
// What is typed goes to the form as text; a refusal of the server for the field is said under it, in red.
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { IonInput } from '@ionic/vue';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { ref, shallowRef, type Component } from 'vue';

import { createShellI18n } from '../../shell/i18n';
import * as components from '../index';
import SettingsNumberField, { type SettingsNumberFieldState, type SettingsTextField } from './SettingsNumberField.vue';
import type { SettingsForm } from './settingsForm';
import type { FormModalError } from './types';
import { settingsFormOn, stopSettingsForms } from './__tests__/settings-form';

interface Form {
  default_duration: string;
  slot_interval: string;
  allow_overlapping: boolean;
}

const FORM: Form = { default_duration: '30', slot_interval: '15', allow_overlapping: false };

/** What useSettingsForm gives the field, by hand. */
function state(form: Form | null = FORM, errors: Record<string, string> = {}) {
  return {
    form: shallowRef<Form | null>(form),
    fieldErrors: ref<Record<string, string>>(errors),
    set: vi.fn(<K extends keyof Form>(field: K, value: Form[K]): void => {
      void field;
      void value;
    }),
  };
}

type Control = HTMLElement & { value?: unknown; errorText?: string; helperText?: string; disabled?: boolean };

const mounted: VueWrapper[] = [];
afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
});

/** What a page may set on the field, besides its form. */
interface FieldProps {
  field?: SettingsTextField<Form>;
  label?: string;
  testid?: string;
  helperText?: string;
  min?: number | string;
  max?: number | string;
  step?: string;
  inputmode?: 'numeric' | 'decimal';
  disabled?: boolean;
}

/** Mounts the field of `default_duration` (or the one `props` names), with the page's label and test id. */
function mountField(settings: SettingsNumberFieldState<Form>, props: FieldProps = {}) {
  // A generic component: Vue Test Utils cannot work its props out (DataTable's harness mounts it the same way).
  const wrapper = mount(SettingsNumberField as unknown as Component, {
    props: { settings, field: 'default_duration', label: 'Default duration (minutes)', testid: 'demo-settings-default_duration', ...props },
    global: { plugins: [createShellI18n({ locale: 'en' })] },
  });
  mounted.push(wrapper);
  const input = () => wrapper.findComponent(IonInput);
  const element = () => input().element as Control;
  /** Types `value` as Ionic does: the element holds it, then says `ionInput`. */
  async function type(value: unknown): Promise<void> {
    element().value = value;
    element().dispatchEvent(new CustomEvent('ionInput', { detail: { value }, bubbles: true }));
    await flushPromises();
  }
  // Ionic's property holds '' once Vue clears it: no message either way.
  const errorText = () => element().errorText || undefined;
  const marked = () => ['ion-invalid', 'ion-touched'].every((name) => input().classes().includes(name));
  return { wrapper, input, element, type, errorText, marked };
}

describe('SettingsNumberField', () => {
  it('is in @erplora/ui/components, next to useSettingsForm and SettingsFormFooter', () => {
    expect(components.SettingsNumberField).toBe(SettingsNumberField);
  });

  it('is an outlined md number box with its floating label, the number keyboard, the form value and its test id', () => {
    const f = mountField(state());
    const input = f.input();
    expect([
      input.props('type'),
      input.props('inputmode'),
      input.props('labelPlacement'),
      input.props('fill'),
      input.attributes('mode'),
      input.props('label'),
      input.props('modelValue'),
    ]).toEqual(['number', 'numeric', 'floating', 'outline', 'md', 'Default duration (minutes)', '30']);
    expect(input.attributes('data-testid')).toBe('demo-settings-default_duration');
    expect(f.element().value).toBe('30');
    // No help unless the page gives it (Ionic Vue marks a prop it was not given with a symbol: the element has none).
    expect([f.element().helperText, f.errorText(), f.marked(), input.props('disabled')]).toEqual([undefined, undefined, false, false]);
  });

  it('every text is the page one: its label and its help', () => {
    const f = mountField(state(), { label: 'Duración por defecto (minutos)', helperText: 'Lo que propone una cita nueva.' });
    expect([f.input().props('label'), f.input().props('helperText')]).toEqual(['Duración por defecto (minutos)', 'Lo que propone una cita nueva.']);
  });

  it('paints the field it names, and follows the form: a value saved elsewhere repaints it', async () => {
    const settings = state();
    const f = mountField(settings, { field: 'slot_interval', testid: 'demo-settings-slot_interval' });
    expect(f.input().props('modelValue')).toBe('15');
    settings.form.value = { ...FORM, slot_interval: '20' };
    await flushPromises();
    expect([f.input().props('modelValue'), f.element().value]).toEqual(['20', '20']);
  });

  it('before the settings come it is empty', () => {
    const f = mountField(state(null));
    expect(f.input().props('modelValue')).toBe('');
  });

  it('what is typed goes to the form as text, under the field name', async () => {
    const settings = state();
    const f = mountField(settings);
    await f.type('45');
    expect(settings.set).toHaveBeenLastCalledWith('default_duration', '45');
    await f.type(12);
    expect(settings.set).toHaveBeenLastCalledWith('default_duration', '12');
    // An emptied box (Ionic says `null` or nothing): empty text, for the server to refuse under the field.
    await f.type(null);
    expect(settings.set).toHaveBeenLastCalledWith('default_duration', '');
    await f.type(undefined);
    expect(settings.set).toHaveBeenLastCalledWith('default_duration', '');
    expect(settings.set).toHaveBeenCalledTimes(4);
  });

  it('a refusal of the server for the field is said under it, in red; another field’s is not', async () => {
    const settings = state(FORM, { default_duration: 'Ensure this value is greater than or equal to 5.' });
    const f = mountField(settings);
    expect([f.errorText(), f.marked()]).toEqual(['Ensure this value is greater than or equal to 5.', true]);
    // useSettingsForm takes the message away once the field is changed: the box loses it and its red.
    settings.fieldErrors.value = { slot_interval: 'Too short.' };
    await flushPromises();
    expect([f.errorText(), f.marked()]).toEqual([undefined, false]);
  });

  describe('what differs by page', () => {
    it('its range and step (`min`, `max`, `step`)', () => {
      const f = mountField(state(), { min: 1, max: 600, step: '1' });
      expect([f.input().props('min'), f.input().props('max'), f.input().props('step')]).toEqual([1, 600, '1']);
    });

    it('`inputmode="decimal"`: the decimal keyboard (Attendance, the coordinates)', () => {
      const f = mountField(state(), { inputmode: 'decimal', step: 'any' });
      expect([f.input().props('inputmode'), f.input().props('step')]).toEqual(['decimal', 'any']);
    });

    it('`disabled`: whoever may not change the settings reads them (Inventory, Attendance)', () => {
      const f = mountField(state(), { disabled: true });
      expect(f.input().props('disabled')).toBe(true);
    });
  });

  describe('with useSettingsForm', () => {
    afterEach(stopSettingsForms);

    type Out = { default_duration: number; slot_interval: number; allow_overlapping: boolean };
    type In = Partial<Out>;

    const toForm = (out: Out): Form => ({
      default_duration: String(out.default_duration),
      slot_interval: String(out.slot_interval),
      allow_overlapping: out.allow_overlapping,
    });

    function mountPage(answer: (input: In) => Promise<Out>) {
      const data = shallowRef<Out>({ default_duration: 30, slot_interval: 15, allow_overlapping: false });
      const { cmd, settings } = settingsFormOn<Out, Form, In>(data, answer, { toForm, numbers: ['default_duration', 'slot_interval'] });
      return { cmd, settings, ...mountField(settings) };
    }

    it('takes what useSettingsForm gives as it is', () => {
      expectTypeOf<SettingsForm<Form, In>>().toMatchTypeOf<SettingsNumberFieldState<Form>>();
    });

    it('what is typed is the form’s, and «Save» sends it as a number', async () => {
      const f = mountPage(async (input) => ({ default_duration: input.default_duration ?? 30, slot_interval: 15, allow_overlapping: false }));
      await f.type('45');
      expect(f.settings.form.value?.default_duration).toBe('45');
      expect(f.settings.changes.value).toEqual({ default_duration: 45 });
      await f.settings.save();
      await flushPromises();
      expect(f.cmd.run).toHaveBeenCalledWith({ default_duration: 45 });
      expect(f.input().props('modelValue')).toBe('45');
    });

    it('a refusal marks the field in red with its reason, and correcting the field lifts both', async () => {
      const refusal: FormModalError = {
        code: 'invalid_payload',
        message: 'Check the highlighted details.',
        status: 422,
        fields: { default_duration: 'Ensure this value is greater than or equal to 5.' },
      };
      const f = mountPage(async () => Promise.reject(refusal));
      await f.type('2');
      await f.settings.save();
      await flushPromises();
      expect([f.errorText(), f.marked()]).toEqual(['Ensure this value is greater than or equal to 5.', true]);
      await f.type('20');
      expect([f.errorText(), f.marked()]).toEqual([undefined, false]);
    });
  });
});
