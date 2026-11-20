import { describe, expect, expectTypeOf, it } from 'vitest';
import { effectScope, nextTick } from 'vue';

import { createTestClient } from '../../sdk/__tests__/live-harness';
import { useCommand } from '../../sdk/use-command';
import { useLive } from '../../sdk/use-live';
import * as components from '../index';
import { useSettingsForm } from './settingsForm';
import { SAVED, SERVICE, service, setup, type ServiceForm, type ServiceIn, type ServiceOut } from './__tests__/use-settings-form';

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

  // A field changed while the save is on its way is the person's still, not the answer's.
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
});
