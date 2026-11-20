import { describe, expect, it } from 'vitest';
import { effectScope, nextTick, shallowRef } from 'vue';

import { createTestClient } from '../../sdk/__tests__/live-harness';
import { useCommand } from '../../sdk/use-command';
import { useSettingsForm } from './settingsForm';
import type { FormModalError } from './types';
import { SAVED, service } from './__tests__/use-settings-form';

const BY_FIELDS: FormModalError = {
  code: 'invalid_payload',
  message: 'Check the highlighted details.',
  status: 422,
  fields: { default_duration: 'Ensure this value is at most 480.', page_title: 'Too long.', default_tax_category_key: 'No such tax.' },
};

describe('useSettingsForm', () => {
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

    // After a failed save, the field typed back to what is saved and «Save» again: nothing is sent and it
    // says saved, so the failed save's notice saying otherwise next to it would be a lie.
    describe('a save with nothing to send is a try', () => {
      const NO_CONNECTION: FormModalError = { code: 'client_error', message: 'No connection.', status: 0 };

      async function refusedThenTypedBack(refusal: FormModalError) {
        const s = service();
        s.form.set('page_title', 'Other');
        s.error.value = refusal;
        await nextTick();
        s.form.set('page_title', SAVED.page_title);
        return s;
      }

      it('a refusal that names no field goes, and it says saved', async () => {
        const { form, command } = await refusedThenTypedBack(NO_CONNECTION);
        expect(form.showsError.value).toBe(true);
        await form.save();
        expect([command.run.mock.calls.length, form.saved.value, form.showsError.value]).toEqual([0, true, false]);
      });

      it('a refusal of the whole form goes too', async () => {
        const { form } = await refusedThenTypedBack({ code: 'invalid_payload', message: 'Not now.', status: 422, fields: { __all__: 'Not now.' } });
        expect(form.showsError.value).toBe(true);
        await form.save();
        expect([form.showsError.value, form.fieldErrors.value]).toEqual([false, {}]);
      });

      it('every refused field’s message goes, not only the one typed back', async () => {
        const { form } = await refusedThenTypedBack(BY_FIELDS);
        expect(form.fieldErrors.value).toEqual({ default_duration: 'Ensure this value is at most 480.', default_tax_category_key: 'No such tax.' });
        await form.save();
        expect(form.fieldErrors.value).toEqual({});
      });

      it('changing a field after it brings back nothing of the old refusal', async () => {
        const { form } = await refusedThenTypedBack(BY_FIELDS);
        await form.save();
        form.set('show_prices', false);
        expect([form.showsError.value, form.fieldErrors.value]).toEqual([false, {}]);
      });

      it('the next refusal, the same again, says it all again', async () => {
        const { form, error } = await refusedThenTypedBack(BY_FIELDS);
        await form.save();
        error.value = null; // useCommand empties it as a try starts
        await nextTick();
        error.value = { ...BY_FIELDS };
        await nextTick();
        expect([form.showsError.value, form.fieldErrors.value]).toEqual([true, BY_FIELDS.fields]);
      });

      it('the next refusal says itself, with useCommand as it is', async () => {
        const { client, net } = createTestClient({ routes: { 'test.item.detail': { method: 'patch', path: '/api/test/settings' } } });
        net.onApi(() => Response.json({ error: { code: 'conflict', message: 'Someone else changed it.' } }, { status: 409 }));
        const scope = effectScope();
        const form = scope.run(() =>
          useSettingsForm(shallowRef({ id: 'i1', name: 'Saved' }), useCommand('test.item.detail', { client }), { toForm: (item) => ({ name: item.name }) }),
        )!;
        form.set('name', 'Other');
        await form.save();
        await nextTick();
        form.set('name', 'Saved');
        await form.save();
        expect([form.saved.value, form.showsError.value]).toEqual([true, false]);
        form.set('name', 'Other');
        await form.save();
        await nextTick();
        expect([form.saved.value, form.showsError.value]).toEqual([false, true]);
        scope.stop();
      });
    });
  });
});
