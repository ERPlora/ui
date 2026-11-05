// useRefusal — what a refused form still says while the person corrects it: FormModal's rule (ui#88,
// ui#89; Odoo, WooCommerce, Shopify), for any form, a page's included (hub#821).
//   const { run, error } = useCommand('app.settings.update');
//   const { fieldErrors, showsError, changed, sayItAllAgain } = useRefusal(error);
//   <InlineFeedback v-if="showsError" …>{{ error?.message }}</InlineFeedback>
//   <ion-input :error-text="fieldErrors.email" @ion-input="email = …; changed('email')" />
//   async function save() { sayItAllAgain(); await run(…) }
// Contract:
//   - A refusal with `fields` says on top only «check the highlighted details»: `showsError` goes false
//     as soon as something is changed (`changed()`) and comes back with the next refusal or try.
//   - Each field's message (`fieldErrors`) goes away as soon as that field is changed
//     (`changed(name)`), and the next refusal or try (`sayItAllAgain()`) says them all again.
//   - A refusal without `fields`, or of the whole form (`__all__`, as Django forms name it), stays until
//     the next try: nothing else says it, and changing a field never takes it away.
//   - A refusal is told by its value, not by its object: a parent that hands the same refusal again
//     does not bring back what was corrected. So a new try must say it (`sayItAllAgain()`) when it
//     may be refused with the very same words.
import { computed, shallowRef, toValue, watch, type ComputedRef, type MaybeRefOrGetter } from 'vue';

import type { FormModalError } from './types';

/** The key of the whole form's reason (Django forms' `NON_FIELD_ERRORS`): it is no field. */
export const NON_FIELD_ERRORS = '__all__';

export interface Refusal {
  /** Every field the refusal names, with its message (`{}` without a refusal by fields). */
  readonly refusedFields: ComputedRef<Readonly<Record<string, string>>>;
  /** What the fields still say: the refusal's messages but those of the fields changed since. */
  readonly fieldErrors: ComputedRef<Readonly<Record<string, string>>>;
  /** Whether the error's notice still has something to say. */
  readonly showsError: ComputedRef<boolean>;
  /** The person changed something: `field`, the one changed, when the form knows which. */
  changed(field?: string): void;
  /** A new try (or a new opening): every message is said again. */
  sayItAllAgain(): void;
}

export interface UseRefusalOptions {
  /** After a new refusal has reset what was corrected (`true`), or after the refusal went (`false`). */
  onRefusal?: (refused: boolean) => void;
}

export function useRefusal(
  error: MaybeRefOrGetter<FormModalError | null | undefined>,
  options: UseRefusalOptions = {},
): Refusal {
  const refusedFields = computed<Readonly<Record<string, string>>>(() => toValue(error)?.fields ?? {});
  /** Something was changed since the refusal: its notice has done its job. */
  const edited = shallowRef(false);
  /** The refused fields the person has changed since: their message has done its job too. */
  const corrected = shallowRef<ReadonlySet<string>>(new Set());
  const fieldErrors = computed<Readonly<Record<string, string>>>(() =>
    Object.fromEntries(Object.entries(refusedFields.value).filter(([name]) => !corrected.value.has(name))),
  );
  /** The notice only repeats what the marked fields say, unless the whole form is refused. */
  const onlyPointsAtFields = computed(() => {
    const names = Object.keys(refusedFields.value);
    return names.length > 0 && !names.includes(NON_FIELD_ERRORS);
  });
  const showsError = computed(() => !!toValue(error) && !(edited.value && onlyPointsAtFields.value));

  function changed(field?: string): void {
    edited.value = true;
    if (field && field !== NON_FIELD_ERRORS && !corrected.value.has(field)) {
      corrected.value = new Set([...corrected.value, field]);
    }
  }

  function sayItAllAgain(): void {
    edited.value = false;
    corrected.value = new Set();
  }

  // By value, not by object. Named, because an `ApiError`'s `message` is not enumerable and
  // `JSON.stringify` would leave it out.
  watch(
    () => {
      const current = toValue(error);
      return current ? JSON.stringify([current.status, current.code, current.message, current.fields]) : '';
    },
    (refusal) => {
      sayItAllAgain();
      options.onRefusal?.(!!refusal);
    },
  );

  return { refusedFields, fieldErrors, showsError, changed, sayItAllAgain };
}
