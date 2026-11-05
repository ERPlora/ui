// useRefusal: what a refused form still says while the person corrects it (ui#88, ui#89; hub#821). The
// notice of a refusal by fields goes as soon as something changes; each field's message as soon as that
// field changes; a refusal of the whole form, or without fields, stays until the next try; a new refusal
// or a new try says it all again.
import { describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, shallowRef } from 'vue';

import * as components from '../index';
import { useRefusal } from './refusal';
import type { FormModalError } from './types';

const BY_FIELDS: FormModalError = {
  code: 'invalid_payload',
  message: 'Check the highlighted details.',
  status: 422,
  fields: { email: 'Enter a valid email address.', name: 'This field is required.' },
};

function setup(initial: FormModalError | null = null, onRefusal?: (refused: boolean) => void) {
  const error = shallowRef<FormModalError | null>(initial);
  const scope = effectScope();
  const refusal = scope.run(() => useRefusal(error, { onRefusal }))!;
  return { error, refusal, scope };
}

describe('useRefusal', () => {
  it('is in @erplora/ui/components, for the pages’ own forms', () => {
    expect(components.useRefusal).toBe(useRefusal);
  });

  it('says nothing without a refusal', () => {
    const { refusal } = setup();
    expect([refusal.showsError.value, refusal.fieldErrors.value, refusal.refusedFields.value]).toEqual([false, {}, {}]);
  });

  it('says the refusal: its notice and every field’s message', () => {
    const { refusal } = setup(BY_FIELDS);
    expect(refusal.showsError.value).toBe(true);
    expect(refusal.fieldErrors.value).toEqual(BY_FIELDS.fields);
  });

  it('a change takes away the notice of a refusal by fields, and the fields keep their messages', () => {
    const { refusal } = setup(BY_FIELDS);
    refusal.changed();
    expect(refusal.showsError.value).toBe(false);
    expect(refusal.fieldErrors.value).toEqual(BY_FIELDS.fields);
  });

  it('changing a refused field takes its message away, and nobody else’s', () => {
    const { refusal } = setup(BY_FIELDS);
    refusal.changed('email');
    expect(refusal.showsError.value).toBe(false);
    expect(refusal.fieldErrors.value).toEqual({ name: 'This field is required.' });
    expect(refusal.refusedFields.value).toEqual(BY_FIELDS.fields);
  });

  it('a field the refusal does not name changes nothing of the others', () => {
    const { refusal } = setup(BY_FIELDS);
    refusal.changed('phone');
    expect(refusal.fieldErrors.value).toEqual(BY_FIELDS.fields);
  });

  it('a refusal of the whole form stays: no field is it', () => {
    const { refusal } = setup({ ...BY_FIELDS, fields: { __all__: 'The dates overlap.', email: 'Enter a valid email address.' } });
    refusal.changed('email');
    refusal.changed('__all__');
    expect(refusal.showsError.value).toBe(true);
    expect(refusal.fieldErrors.value).toEqual({ __all__: 'The dates overlap.' });
  });

  it('a refusal without fields stays until the next try: nothing else says it', () => {
    const { refusal } = setup({ code: 'conflict', message: 'Someone else changed it.', status: 409 });
    refusal.changed();
    expect(refusal.showsError.value).toBe(true);
  });

  it('a new try says it all again', () => {
    const { refusal } = setup(BY_FIELDS);
    refusal.changed('email');
    refusal.sayItAllAgain();
    expect(refusal.showsError.value).toBe(true);
    expect(refusal.fieldErrors.value).toEqual(BY_FIELDS.fields);
  });

  it('a new refusal says it all again, and says so', async () => {
    const onRefusal = vi.fn();
    const { error, refusal } = setup(BY_FIELDS, onRefusal);
    refusal.changed('email');
    error.value = { ...BY_FIELDS, fields: { email: 'This email is taken.' } };
    await nextTick();
    expect(refusal.showsError.value).toBe(true);
    expect(refusal.fieldErrors.value).toEqual({ email: 'This email is taken.' });
    expect(onRefusal).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('the same refusal painted again is no new refusal: what was corrected stays corrected', async () => {
    const onRefusal = vi.fn();
    const { error, refusal } = setup(BY_FIELDS, onRefusal);
    refusal.changed('email');
    error.value = { ...BY_FIELDS, fields: { ...BY_FIELDS.fields } };
    await nextTick();
    expect(refusal.fieldErrors.value).toEqual({ name: 'This field is required.' });
    expect(onRefusal).not.toHaveBeenCalled();
  });

  it('the refusal going away says so too', async () => {
    const onRefusal = vi.fn();
    const { error, refusal } = setup(BY_FIELDS, onRefusal);
    error.value = null;
    await nextTick();
    expect([refusal.showsError.value, refusal.fieldErrors.value]).toEqual([false, {}]);
    expect(onRefusal).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('takes a getter too, and stops following it with its scope', async () => {
    const onRefusal = vi.fn();
    const source = shallowRef<FormModalError | null>(null);
    const scope = effectScope();
    const refusal = scope.run(() => useRefusal(() => source.value, { onRefusal }))!;
    source.value = BY_FIELDS;
    await nextTick();
    expect(refusal.fieldErrors.value).toEqual(BY_FIELDS.fields);
    scope.stop();
    source.value = null;
    await nextTick();
    expect(onRefusal).toHaveBeenCalledExactlyOnceWith(true);
  });
});
