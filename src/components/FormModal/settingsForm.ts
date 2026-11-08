// useSettingsForm — a settings page's form, the one every «Settings» tab of the Hub had copied (hub#867;
// APPOINTMENT-F19, RESERVATION-F03, ONLINE_BOOKING-F07, STAFF-F22, TABLE-F08, KITCHEN-F26, ATTENDANCE-F04,
// SERVICE-F11):
//   const { data } = useLive('app.settings.get', {});
//   const { form, dirty, saved, pending, error, fieldErrors, showsError, set, save } =
//     useSettingsForm(data, useCommand('app.settings.update'), { toForm, numbers: ['default_duration'] });
//   <ion-input :value="form.default_duration" :error-text="fieldErrors.default_duration"
//              @ion-input="set('default_duration', text($event.detail.value))" />
//   <InlineFeedback v-if="showsError" …>{{ error?.message }}</InlineFeedback>
// Contract:
//   - `form` is null until the settings come; then it is what the server has (`toForm`), and a change
//     saved elsewhere repaints every field the person has not touched (what was typed stays).
//   - Only the fields touched and changed are sent (`changes`), so a save never undoes someone else's:
//     texts without their edge spaces, the `numbers` fields as numbers when they hold a whole number (else
//     as typed, for the server to refuse under the field), and a field the server knows otherwise
//     (`server`) under its name there and with its value there, compared by that value.
//   - Fields that are one value (`together`, a pair of coordinates) are sent all when one changed, and
//     changing one is changing all of them.
//   - A refusal says itself as a FormModal does (`useRefusal`): `set` tells it which field changed, by its
//     name on the server. What the screen judges before sending (`judge`) goes under its field the same
//     way and sends nothing.
//   - `save` sends the changes and paints the answer: what was sent is left as the server kept it. A field
//     changed while the save was on its way stays as typed and still to send (hub#914), and `saved` says so
//     only when nothing is left to send; with nothing to send it sends nothing and says it too (what is on
//     screen is what is saved). That is a try as well: the last refusal, which said otherwise, says nothing
//     more (neither its notice nor its fields' messages) until the next refusal (hub#894). A failed save
//     keeps what was typed; the command's `error` says why.
import { computed, shallowRef, toValue, watch, type ComputedRef, type MaybeRefOrGetter, type Ref, type ShallowRef } from 'vue';

import { useRefusal } from './refusal';
import type { FormModalError } from './types';

/** How the server knows a form field, when not by the same name and value. */
export interface SettingsServerField<V> {
  /** Its name on the server (in what is sent and in a refusal): `tax` → `default_tax_category_key`. */
  name?: string;
  /** Its value on the server (the chosen option's id, a coordinate or `null`); changes are told by it. */
  value?: (value: V) => unknown;
}

export interface SettingsFormOptions<Out, Form extends object> {
  /** The server's settings as the form holds them (inputs hold text). */
  toForm: (settings: Out) => Form;
  /** The fields sent as numbers: a whole number typed in them goes as a number. */
  numbers?: readonly (keyof Form)[];
  /** The fields the server knows by another name or value. */
  server?: { [K in keyof Form]?: SettingsServerField<Form[K]> };
  /** Fields that are one value (a pair of coordinates): one changed sends them all, and lifts all their marks. */
  together?: readonly (readonly (keyof Form)[])[];
  /** What the screen can tell is wrong before sending, by field (`null` or `{}` when nothing is). */
  judge?: (form: Form) => Partial<Record<keyof Form, string>> | null | undefined;
}

/** What `useCommand(op)` gives: the settings form only needs these. */
export interface SettingsCommand<In, Out> {
  run(input: In): Promise<Out>;
  pending: Readonly<Ref<boolean>>;
  error: Readonly<Ref<FormModalError | null | undefined>>;
}

export interface SettingsForm<Form extends object, In> {
  /** What the person sees and types; null until the settings come. */
  readonly form: ShallowRef<Form | null>;
  /** What the server has (the last result of the stream, or of a save). */
  readonly original: ShallowRef<Form | null>;
  /** The fields the person changed since the last save: only these are sent. */
  readonly touched: ShallowRef<ReadonlySet<keyof Form>>;
  /** The last save went through and nothing was changed since. */
  readonly saved: ShallowRef<boolean>;
  /** What «Save» sends: the touched fields that differ, as the server knows them. */
  readonly changes: ComputedRef<In>;
  /** There is something to send. */
  readonly dirty: ComputedRef<boolean>;
  /** What each field says, by its name on the server: the refusal's messages and the screen's. */
  readonly fieldErrors: ComputedRef<Readonly<Record<string, string>>>;
  /** Whether the refusal's notice still has something to say. */
  readonly showsError: ComputedRef<boolean>;
  /** The command's: a save on its way. */
  readonly pending: Readonly<Ref<boolean>>;
  /** The command's: why the last save failed. */
  readonly error: Readonly<Ref<FormModalError | null | undefined>>;
  /** The person changed `field` to `value`. */
  set<K extends keyof Form>(field: K, value: Form[K]): void;
  /** Judges, sends the changes and paints the answer. */
  save(): Promise<void>;
}

const WHOLE_NUMBER = /^\d+$/;

export function useSettingsForm<Out, Form extends object, In extends object>(
  data: MaybeRefOrGetter<Out | null | undefined>,
  command: SettingsCommand<In, Out>,
  options: SettingsFormOptions<Out, Form>,
): SettingsForm<Form, In> {
  type Field = keyof Form;
  const numbers = new Set<Field>(options.numbers ?? []);
  const server = (options.server ?? {}) as Partial<Record<Field, SettingsServerField<unknown>>>;
  const together = options.together ?? [];

  /** A save with nothing to send went through after the last refusal: it has nothing more to say (hub#894). */
  const outdated = shallowRef(false);
  const refusal = useRefusal(command.error, {
    onRefusal: () => {
      outdated.value = false;
    },
  });
  const showsError = computed(() => !outdated.value && refusal.showsError.value);

  // Typed by hand: `shallowRef`'s return type cannot be worked out for a generic `Form`.
  const form = shallowRef(null) as ShallowRef<Form | null>;
  const original = shallowRef(null) as ShallowRef<Form | null>;
  const touched = shallowRef<ReadonlySet<Field>>(new Set());
  const saved = shallowRef(false);
  /** What the screen judged wrong at the last «Save», by field. */
  const judged = shallowRef<Partial<Record<Field, string>>>({});

  const nameOf = (field: Field): string => server[field]?.name ?? String(field);
  /** The field and the ones that are one value with it. */
  const groupOf = (field: Field): readonly Field[] => together.find((group) => group.includes(field)) ?? [field];

  /** A field's value as the server knows it. */
  function sent(field: Field, value: unknown): unknown {
    const toServer = server[field]?.value;
    if (toServer) return toServer(value);
    const text = typeof value === 'string' ? value.trim() : value;
    return numbers.has(field) && typeof text === 'string' && WHOLE_NUMBER.test(text) ? Number(text) : text;
  }

  const changes = computed<In>(() => {
    const now = form.value;
    const was = original.value;
    const out: Record<string, unknown> = {};
    if (!now || !was) return out as In;
    for (const field of touched.value) {
      const group = groupOf(field);
      if (group.every((key) => sent(key, now[key]) === sent(key, was[key]))) continue;
      for (const key of group) out[nameOf(key)] = sent(key, now[key]);
    }
    return out as In;
  });
  const dirty = computed(() => Object.keys(changes.value).length > 0);

  const fieldErrors = computed<Readonly<Record<string, string>>>(() => ({
    ...(outdated.value ? {} : refusal.fieldErrors.value),
    ...Object.fromEntries(Object.entries(judged.value).map(([field, message]) => [nameOf(field as Field), message as string])),
  }));

  /** What the server has, with the fields in `keep` as the person has them on screen. */
  function painted(fresh: Form, keep: ReadonlySet<Field>): Form {
    const current = form.value;
    if (!current) return { ...fresh };
    return Object.fromEntries((Object.keys(fresh) as Field[]).map((key) => [key, keep.has(key) ? current[key] : fresh[key]])) as Form;
  }

  // What the server says repaints every field the person has not touched.
  watch(
    () => toValue(data),
    (settings) => {
      if (!settings) return;
      const fresh = options.toForm(settings);
      original.value = fresh;
      form.value = painted(fresh, touched.value);
    },
    { immediate: true },
  );

  function set<K extends Field>(field: K, value: Form[K]): void {
    if (!form.value) return;
    form.value = { ...form.value, [field]: value };
    touched.value = new Set([...touched.value, field]);
    saved.value = false;
    const group = groupOf(field);
    for (const key of group) refusal.changed(nameOf(key));
    if (group.some((key) => key in judged.value)) {
      judged.value = Object.fromEntries(Object.entries(judged.value).filter(([key]) => !group.includes(key as Field))) as Partial<Record<Field, string>>;
    }
  }

  async function save(): Promise<void> {
    if (!form.value || command.pending.value) return;
    const verdict = Object.fromEntries(Object.entries(options.judge?.(form.value) ?? {}).filter(([, message]) => !!message));
    judged.value = verdict as Partial<Record<Field, string>>;
    if (Object.keys(verdict).length > 0) {
      saved.value = false;
      return;
    }
    if (!dirty.value) {
      outdated.value = true;
      saved.value = true;
      return;
    }
    const sentForm = form.value;
    try {
      const answer = await command.run(changes.value);
      const kept = options.toForm(answer);
      // What was sent is the server's now; a field the person changed while the save was on its way stays.
      const still = new Set([...touched.value].filter((field) => form.value?.[field] !== sentForm[field]));
      original.value = kept;
      form.value = painted(kept, still);
      touched.value = still;
      saved.value = !dirty.value;
    } catch {
      saved.value = false; // The page paints the command's error; what was typed stays.
    }
  }

  return { form, original, touched, saved, changes, dirty, fieldErrors, showsError, pending: command.pending, error: command.error, set, save };
}
