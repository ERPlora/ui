// useSettingsForm: a settings page's form, said once for every page (hub#867). It paints what the server
// has; what the person touched and changed is all that is sent, with the server's names and values (the
// numbers as numbers, a renamed field under its name there); a change saved elsewhere repaints every field
// not touched; a refusal says itself as a FormModal does (useRefusal); the screen can judge before sending.
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { effectScope, nextTick, ref, shallowRef } from 'vue';

import { createTestClient } from '../../sdk/__tests__/live-harness';
import { useCommand } from '../../sdk/use-command';
import { useLive } from '../../sdk/use-live';
import * as components from '../index';
import { useSettingsForm, type SettingsFormOptions } from './settingsForm';
import type { FormModalError } from './types';

// A page like Services' (SERVICE-F11): numbers, a text, a switch and a field the server names otherwise.
interface ServiceOut {
  default_duration: number;
  page_title: string;
  show_prices: boolean;
  default_tax_category_key: string | null;
  default_tax_category_name: string | null;
}
type Option = { id: string; label: string } | null;
interface ServiceForm {
  default_duration: string;
  page_title: string;
  show_prices: boolean;
  tax: Option;
}
type ServiceIn = Partial<Omit<ServiceOut, 'default_tax_category_name'>>;

const SAVED: ServiceOut = {
  default_duration: 60,
  page_title: 'Book with us',
  show_prices: true,
  default_tax_category_key: 'general',
  default_tax_category_name: 'General VAT',
};

const SERVICE: SettingsFormOptions<ServiceOut, ServiceForm> = {
  toForm: (settings) => ({
    default_duration: String(settings.default_duration),
    page_title: settings.page_title,
    show_prices: settings.show_prices,
    tax: settings.default_tax_category_key
      ? { id: settings.default_tax_category_key, label: settings.default_tax_category_name ?? settings.default_tax_category_key }
      : null,
  }),
  numbers: ['default_duration'],
  server: { tax: { name: 'default_tax_category_key', value: (option) => option?.id ?? null } },
};

function setup<Out, Form extends object, In extends object>(
  options: SettingsFormOptions<Out, Form>,
  initial: Out | undefined,
  run: (input: In) => Promise<Out> = vi.fn(),
) {
  const data = shallowRef<Out | undefined>(initial);
  const pending = ref(false);
  const error = shallowRef<FormModalError | null>(null);
  const command = { run: vi.fn(run), pending, error };
  const scope = effectScope();
  const form = scope.run(() => useSettingsForm(data, command, options))!;
  return { data, pending, error, command, form, scope };
}

const service = (run?: (input: ServiceIn) => Promise<ServiceOut>) => setup<ServiceOut, ServiceForm, ServiceIn>(SERVICE, SAVED, run);

const BY_FIELDS: FormModalError = {
  code: 'invalid_payload',
  message: 'Check the highlighted details.',
  status: 422,
  fields: { default_duration: 'Ensure this value is at most 480.', page_title: 'Too long.', default_tax_category_key: 'No such tax.' },
};

describe('useSettingsForm', () => {
  it('is in @erplora/ui/components, next to useRefusal', () => {
    expect(components.useSettingsForm).toBe(useSettingsForm);
  });

  it('takes what useLive and useCommand give, as they come', () => {
    const { client } = createTestClient();
    const scope = effectScope();
    const form = scope.run(() => {
      const { data } = useLive('test.item.detail', { id: 'i1' }, { client });
      return useSettingsForm(data, useCommand('test.item.detail', { client }), { toForm: (item) => ({ name: item.name }) });
    })!;
    expectTypeOf(form.changes.value).toEqualTypeOf<{ id: string }>();
    expectTypeOf(form.set).parameter(0).toEqualTypeOf<'name'>();
    expect(form.form.value).toBeNull();
    scope.stop();
  });

  it('has no form until the settings come, and then paints them', async () => {
    const { data, form } = setup<ServiceOut, ServiceForm, ServiceIn>(SERVICE, undefined);
    expect(form.form.value).toBeNull();
    data.value = SAVED;
    await nextTick();
    const painted = { default_duration: '60', page_title: 'Book with us', show_prices: true, tax: { id: 'general', label: 'General VAT' } };
    expect(form.form.value).toEqual(painted);
    expect(form.original.value).toEqual(painted);
    expect([form.touched.value.size, form.saved.value, form.dirty.value, form.changes.value]).toEqual([0, false, false, {}]);
  });

  it('sends only the fields touched and changed, a number as a number', () => {
    const { form } = service();
    form.set('default_duration', '45');
    form.set('show_prices', true);
    expect(form.changes.value).toEqual({ default_duration: 45 });
    expect(form.dirty.value).toBe(true);
    expect([...form.touched.value].sort()).toEqual(['default_duration', 'show_prices']);
  });

  it('only the fields said to be numbers go as numbers: a text of digits stays a text', () => {
    const { form } = service();
    form.set('page_title', '2026');
    expect(form.changes.value).toEqual({ page_title: '2026' });
  });

  it('a number field that is no whole number goes as typed, for the server to refuse under it', () => {
    const { form } = service();
    form.set('default_duration', '4.5');
    expect(form.changes.value).toEqual({ default_duration: '4.5' });
  });

  it('a whole number typed with edge spaces goes as a number', () => {
    const { form } = service();
    form.set('default_duration', ' 45 ');
    expect(form.changes.value).toEqual({ default_duration: 45 });
  });

  it('a text goes without its edge spaces, and one typed back to what is saved is not sent', () => {
    const { form } = service();
    form.set('page_title', '  Book now ');
    expect(form.changes.value).toEqual({ page_title: 'Book now' });
    form.set('page_title', ' Book with us  ');
    form.set('default_duration', '60');
    expect(form.changes.value).toEqual({});
    expect(form.dirty.value).toBe(false);
  });

  it('a field the server names otherwise goes under its name there, with its value there', () => {
    const { form } = service();
    form.set('tax', { id: 'reduced', label: 'Reduced VAT' });
    expect(form.changes.value).toEqual({ default_tax_category_key: 'reduced' });
    form.set('tax', null);
    expect(form.changes.value).toEqual({ default_tax_category_key: null });
  });

  it('a renamed field is compared by its value there: the same choice with another label is no change', () => {
    const { form } = service();
    form.set('tax', { id: 'general', label: 'IVA general' });
    expect(form.changes.value).toEqual({});
  });

  it('a change saved elsewhere repaints every field not touched, and keeps what was typed', async () => {
    const { data, form } = service();
    form.set('page_title', 'Mine');
    data.value = { ...SAVED, default_duration: 90, page_title: 'Theirs', show_prices: false };
    await nextTick();
    expect(form.form.value).toEqual({ default_duration: '90', page_title: 'Mine', show_prices: false, tax: { id: 'general', label: 'General VAT' } });
    expect(form.original.value?.page_title).toBe('Theirs');
    expect(form.changes.value).toEqual({ page_title: 'Mine' });
  });

  it('a touched field that someone else saved to the same value is no longer a change', async () => {
    const { data, form } = service();
    form.set('default_duration', '90');
    data.value = { ...SAVED, default_duration: 90 };
    await nextTick();
    expect(form.changes.value).toEqual({});
  });

  it('saves the changes and paints the answer: nothing is left as typed, and says so', async () => {
    const { data, form, command } = service(async () => ({ ...SAVED, default_duration: 45 }));
    form.set('default_duration', '45');
    await form.save();
    expect(command.run).toHaveBeenCalledExactlyOnceWith({ default_duration: 45 });
    expect(form.form.value?.default_duration).toBe('45');
    expect(form.original.value?.default_duration).toBe('45');
    expect([form.touched.value.size, form.saved.value, form.dirty.value]).toEqual([0, true, false]);
    data.value = { ...SAVED, default_duration: 30, page_title: 'Theirs' };
    await nextTick();
    expect(form.form.value?.default_duration).toBe('30');
    expect(form.form.value?.page_title).toBe('Theirs');
  });

  it('after a save the form shows what the server kept, not what was typed', async () => {
    const { form } = service(async () => ({ ...SAVED, page_title: 'Book now' }));
    form.set('page_title', '  Book now ');
    await form.save();
    expect(form.form.value?.page_title).toBe('Book now');
  });

  it('a change after a save says nothing is saved yet', async () => {
    const { form } = service(async () => ({ ...SAVED, default_duration: 45 }));
    form.set('default_duration', '45');
    await form.save();
    form.set('page_title', 'New');
    expect(form.saved.value).toBe(false);
  });

  it('a failed save keeps what was typed and does not say it saved', async () => {
    const { form } = service(async () => {
      throw new Error('refused');
    });
    form.set('default_duration', '45');
    await form.save();
    expect(form.form.value?.default_duration).toBe('45');
    expect([form.touched.value.has('default_duration'), form.saved.value, form.changes.value]).toEqual([true, false, { default_duration: 45 }]);
  });

  // hub#914: a field changed while the save is on its way is the person's still, not the answer's.
  describe('a change made while a save is on its way', () => {
    function held() {
      let release: (answer: ServiceOut) => void = () => {};
      const s = service(() => new Promise<ServiceOut>((resolve) => (release = resolve)));
      return { ...s, release: (answer: ServiceOut) => release(answer) };
    }

    it('stays as typed and to send: only what was sent is saved, and it does not say saved', async () => {
      const { form, release } = held();
      form.set('show_prices', false);
      const saving = form.save();
      form.set('default_duration', '45');
      release({ ...SAVED, show_prices: false });
      await saving;
      expect([form.form.value, form.dirty.value, form.saved.value]).toEqual([
        { default_duration: '45', page_title: 'Book with us', show_prices: false, tax: { id: 'general', label: 'General VAT' } },
        true,
        false,
      ]);
      expect([[...form.touched.value], form.changes.value]).toEqual([['default_duration'], { default_duration: 45 }]);
    });

    it('the field that was sent, changed again on the way, keeps its new value to send', async () => {
      const { form, release } = held();
      form.set('default_duration', '45');
      const saving = form.save();
      form.set('default_duration', '50');
      release({ ...SAVED, default_duration: 45 });
      await saving;
      expect([form.form.value?.default_duration, form.original.value?.default_duration]).toEqual(['50', '45']);
      expect([form.changes.value, form.saved.value]).toEqual([{ default_duration: 50 }, false]);
    });

    it('saving what is left sends only it, and then says it is saved', async () => {
      const { form, command, release } = held();
      form.set('show_prices', false);
      const first = form.save();
      form.set('page_title', 'Book now');
      release({ ...SAVED, show_prices: false });
      await first;
      const second = form.save();
      release({ ...SAVED, show_prices: false, page_title: 'Book now' });
      await second;
      expect(command.run.mock.calls).toEqual([[{ show_prices: false }], [{ page_title: 'Book now' }]]);
      expect([form.touched.value.size, form.dirty.value, form.saved.value]).toEqual([0, false, true]);
    });

    it('a field changed on the way to what the server ends up with leaves nothing to send: it says saved', async () => {
      const { form, release } = held();
      form.set('show_prices', false);
      const saving = form.save();
      form.set('page_title', 'Theirs');
      release({ ...SAVED, show_prices: false, page_title: 'Theirs' });
      await saving;
      expect([form.form.value?.page_title, form.dirty.value, form.saved.value]).toEqual(['Theirs', false, true]);
    });

    it('what someone else saved while it was on its way is not taken as the person’s', async () => {
      const { data, form, release } = held();
      form.set('show_prices', false);
      const saving = form.save();
      data.value = { ...SAVED, show_prices: false, page_title: 'Theirs' };
      await nextTick();
      release({ ...SAVED, show_prices: false, page_title: 'Theirs' });
      await saving;
      data.value = { ...SAVED, show_prices: false, page_title: 'Third' };
      await nextTick();
      expect(form.form.value?.page_title).toBe('Third');
      expect([form.touched.value.size, form.dirty.value, form.saved.value]).toEqual([0, false, true]);
    });
  });

  it('sends nothing while a save is on its way', async () => {
    const { form, pending, command } = service();
    form.set('default_duration', '45');
    pending.value = true;
    await form.save();
    expect(command.run).not.toHaveBeenCalled();
  });

  it('with nothing to send, sends nothing and says it is saved: what is on screen is what is saved', async () => {
    const { form, command } = service();
    form.set('default_duration', '60');
    await form.save();
    expect(command.run).not.toHaveBeenCalled();
    expect(form.saved.value).toBe(true);
  });

  it('before the settings come, neither sets nor saves', async () => {
    const { form, command } = setup<ServiceOut, ServiceForm, ServiceIn>(SERVICE, undefined);
    form.set('default_duration', '45');
    await form.save();
    expect([form.form.value, form.touched.value.size, command.run.mock.calls.length]).toEqual([null, 0, 0]);
  });

  it('hands on the command’s pending and error, for the button and the notice', () => {
    const { form, pending, error } = service();
    expect(form.pending).toBe(pending);
    expect(form.error).toBe(error);
  });

  describe('a refusal (as a FormModal says it, useRefusal)', () => {
    async function refused() {
      const s = service();
      s.form.set('page_title', 'Too long a title');
      s.error.value = BY_FIELDS;
      await nextTick();
      return s;
    }

    it('says the notice and each field’s message, by the server’s names', async () => {
      const { form } = await refused();
      expect(form.showsError.value).toBe(true);
      expect(form.fieldErrors.value).toEqual(BY_FIELDS.fields);
    });

    it('changing a field takes away the notice and that field’s message, and nobody else’s', async () => {
      const { form } = await refused();
      form.set('page_title', 'Short');
      expect(form.showsError.value).toBe(false);
      expect(form.fieldErrors.value).toEqual({ default_duration: 'Ensure this value is at most 480.', default_tax_category_key: 'No such tax.' });
    });

    it('a field the server names otherwise loses the message under its name there', async () => {
      const { form } = await refused();
      form.set('tax', { id: 'reduced', label: 'Reduced VAT' });
      expect(form.fieldErrors.value).toEqual({ default_duration: 'Ensure this value is at most 480.', page_title: 'Too long.' });
    });

    it('the next refusal says it all again', async () => {
      const { form, error } = await refused();
      form.set('page_title', 'Short');
      error.value = null;
      await nextTick();
      error.value = { ...BY_FIELDS };
      await nextTick();
      expect(form.showsError.value).toBe(true);
      expect(form.fieldErrors.value).toEqual(BY_FIELDS.fields);
    });

    it('a refusal that names no field stays until the next try: nothing else says it', async () => {
      const { form, error } = service();
      error.value = { code: 'conflict', message: 'Someone else changed it.', status: 409 };
      await nextTick();
      form.set('page_title', 'Other');
      expect(form.showsError.value).toBe(true);
    });
  });

  // A page like Time clock's (ATTENDANCE-F04): a pair of coordinates, an empty one sent as null, and a
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
