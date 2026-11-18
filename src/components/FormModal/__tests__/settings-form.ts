// A settings page's form as the tests of its pieces build it (SettingsFormFooter, SettingsNumberField): the settings
// on `data`, a command whose save answers with `answer`, as `useCommand` gives it, and `useSettingsForm` on them in
// its own effect scope. `stopSettingsForms` (an `afterEach`) stops every form built since the last call.
import { vi } from 'vitest';
import { effectScope, ref, shallowRef, type EffectScope, type MaybeRefOrGetter } from 'vue';

import { useSettingsForm, type SettingsFormOptions } from '../settingsForm';
import type { FormModalError } from '../types';

const scopes: EffectScope[] = [];

/** A command as `useCommand` gives it: pending while on its way, its error after a refusal. */
export function settingsCommand<In, Out>(answer: (input: In) => Promise<Out>) {
  const pending = ref(false);
  const error = shallowRef<FormModalError | null>(null);
  const run = vi.fn(async (input: In): Promise<Out> => {
    pending.value = true;
    error.value = null;
    try {
      return await answer(input);
    } catch (err) {
      error.value = err as FormModalError;
      throw err;
    } finally {
      pending.value = false;
    }
  });
  return { run, pending, error };
}

/** `useSettingsForm` on `data`, saving through a command that answers with `answer`. */
export function settingsFormOn<Out, Form extends object, In extends object>(
  data: MaybeRefOrGetter<Out | null | undefined>,
  answer: (input: In) => Promise<Out>,
  options: SettingsFormOptions<Out, Form>,
) {
  const cmd = settingsCommand<In, Out>(answer);
  const scope = effectScope();
  scopes.push(scope);
  const settings = scope.run(() => useSettingsForm<Out, Form, In>(data, cmd, options))!;
  return { cmd, settings };
}

/** Stops every form `settingsFormOn` built. */
export function stopSettingsForms(): void {
  for (const scope of scopes.splice(0)) scope.stop();
}
