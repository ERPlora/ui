import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';

import type { SettingsFormOptions } from './settingsForm';
import { SAVED, SERVICE, setup, type ServiceForm, type ServiceIn, type ServiceOut } from './__tests__/use-settings-form';

describe('useSettingsForm', () => {
  // A page like Time clock's: a pair of coordinates, an empty one sent as null, and a
  // screen that judges what it can before sending.
  interface ClockOut {
    require_location: boolean;
    workplace_lat: number | null;
    workplace_lng: number | null;
    auto_close_after_hours: number;
  }
  interface ClockForm {
    require_location: boolean;
    workplace_lat: string;
    workplace_lng: string;
    auto_close_after_hours: string;
  }
  type ClockIn = Partial<ClockOut>;
  const coordinate = (value: string): number | null => (value.trim() ? Number(value.trim()) : null);
  const CLOCK_SAVED: ClockOut = { require_location: false, workplace_lat: 40.4168, workplace_lng: -3.7038, auto_close_after_hours: 12 };
  const CLOCK: SettingsFormOptions<ClockOut, ClockForm> = {
    toForm: (settings) => ({
      require_location: settings.require_location,
      workplace_lat: settings.workplace_lat === null ? '' : String(settings.workplace_lat),
      workplace_lng: settings.workplace_lng === null ? '' : String(settings.workplace_lng),
      auto_close_after_hours: String(settings.auto_close_after_hours),
    }),
    numbers: ['auto_close_after_hours'],
    server: { workplace_lat: { value: coordinate }, workplace_lng: { value: coordinate } },
    together: [['workplace_lat', 'workplace_lng']],
    judge: (form) => {
      const hours = Number(form.auto_close_after_hours);
      if (!/^\d+$/.test(form.auto_close_after_hours.trim()) || hours < 1 || hours > 24) return { auto_close_after_hours: 'Between 1 and 24 hours.' };
      if (!form.workplace_lat.trim() !== !form.workplace_lng.trim()) return { [form.workplace_lat.trim() ? 'workplace_lng' : 'workplace_lat']: 'Both or neither.' };
      return null;
    },
  };
  const clock = (run?: (input: ClockIn) => Promise<ClockOut>) => setup<ClockOut, ClockForm, ClockIn>(CLOCK, CLOCK_SAVED, run);

  describe('fields that go together', () => {
    it('one of them changed sends them all, each with its value there', () => {
      const { form } = clock();
      form.set('workplace_lat', '41.3874');
      expect(form.changes.value).toEqual({ workplace_lat: 41.3874, workplace_lng: -3.7038 });
      form.set('workplace_lat', '');
      form.set('workplace_lng', ' ');
      expect(form.changes.value).toEqual({ workplace_lat: null, workplace_lng: null });
    });

    it('none of them changed sends none', () => {
      const { form } = clock();
      form.set('workplace_lat', '40.41680');
      expect(form.changes.value).toEqual({});
    });

    it('changing one takes away the refusal’s message of every one of them, and nobody else’s', async () => {
      const { form, error } = clock();
      error.value = { code: 'invalid_payload', message: 'Check.', status: 422, fields: { workplace_lng: 'Out of range.', auto_close_after_hours: 'Too many.' } };
      await nextTick();
      form.set('workplace_lat', '41');
      expect(form.fieldErrors.value).toEqual({ auto_close_after_hours: 'Too many.' });
    });
  });

  describe('what the screen judges before sending', () => {
    it('a judged field sends nothing and its message goes under it', async () => {
      const { form, command } = clock();
      form.set('auto_close_after_hours', '30');
      await form.save();
      expect(command.run).not.toHaveBeenCalled();
      expect(form.fieldErrors.value).toEqual({ auto_close_after_hours: 'Between 1 and 24 hours.' });
      expect(form.saved.value).toBe(false);
    });

    it('it judges the whole form, not only what changed', async () => {
      const { form, command } = setup<ClockOut, ClockForm, ClockIn>(CLOCK, { ...CLOCK_SAVED, auto_close_after_hours: 30 });
      form.set('require_location', true);
      await form.save();
      expect(command.run).not.toHaveBeenCalled();
      expect(form.fieldErrors.value).toEqual({ auto_close_after_hours: 'Between 1 and 24 hours.' });
    });

    it('a pair half filled is judged on the half left empty', async () => {
      const { form } = clock();
      form.set('workplace_lng', '');
      await form.save();
      expect(form.fieldErrors.value).toEqual({ workplace_lng: 'Both or neither.' });
    });

    it('fixing it takes its message away, its partners’ too, and then it saves', async () => {
      const { form, command } = clock(async () => ({ ...CLOCK_SAVED, workplace_lng: null, workplace_lat: null }));
      form.set('workplace_lng', '');
      await form.save();
      form.set('workplace_lng', '2');
      expect(form.fieldErrors.value).toEqual({});
      form.set('workplace_lat', '');
      form.set('workplace_lng', '');
      await form.save();
      expect(command.run).toHaveBeenCalledExactlyOnceWith({ workplace_lat: null, workplace_lng: null });
      expect(form.saved.value).toBe(true);
    });

    it('changing another field keeps the judged message', async () => {
      const { form } = clock();
      form.set('auto_close_after_hours', '30');
      await form.save();
      form.set('require_location', true);
      expect(form.fieldErrors.value).toEqual({ auto_close_after_hours: 'Between 1 and 24 hours.' });
    });

    it('its messages sit next to the server’s', async () => {
      const { form, error } = clock();
      error.value = { code: 'invalid_payload', message: 'Check.', status: 422, fields: { require_location: 'Not allowed.' } };
      await nextTick();
      form.set('auto_close_after_hours', '0');
      await form.save();
      expect(form.fieldErrors.value).toEqual({ require_location: 'Not allowed.', auto_close_after_hours: 'Between 1 and 24 hours.' });
    });

    it('on a field the server refused too, what the screen judges now is what it says', async () => {
      const { form, error } = clock();
      form.set('auto_close_after_hours', '30');
      error.value = { code: 'invalid_payload', message: 'Check.', status: 422, fields: { auto_close_after_hours: 'Too many.' } };
      await nextTick();
      await form.save();
      expect(form.fieldErrors.value).toEqual({ auto_close_after_hours: 'Between 1 and 24 hours.' });
    });

    it('a judged field the server names otherwise says it under its name there, until it is fixed', async () => {
      const judging = { ...SERVICE, judge: (form: ServiceForm) => (form.tax ? null : { tax: 'Choose a tax.' }) };
      const { form, command } = setup<ServiceOut, ServiceForm, ServiceIn>(judging, SAVED);
      form.set('tax', null);
      await form.save();
      expect(command.run).not.toHaveBeenCalled();
      expect(form.fieldErrors.value).toEqual({ default_tax_category_key: 'Choose a tax.' });
      form.set('tax', { id: 'reduced', label: 'Reduced VAT' });
      expect(form.fieldErrors.value).toEqual({});
    });

    it('a new try judges again: what was judged and is fine now goes', async () => {
      const { form, command } = clock(async () => CLOCK_SAVED);
      form.set('auto_close_after_hours', '30');
      await form.save();
      form.set('require_location', true);
      form.set('auto_close_after_hours', '12');
      await form.save();
      expect(form.fieldErrors.value).toEqual({});
      expect(command.run).toHaveBeenCalledExactlyOnceWith({ require_location: true });
    });
  });
});
