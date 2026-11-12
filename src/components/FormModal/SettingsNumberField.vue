<script lang="ts">
import type { Ref } from 'vue';

/** The fields of a settings form that hold text: a number field holds what is typed in it. */
export type SettingsTextField<Form> = { [K in keyof Form]-?: Form[K] extends string ? K : never }[keyof Form];

/** What the field reads from `useSettingsForm` (its return value fits as it is; a page may hand its own `set`). */
export interface SettingsNumberFieldState<Form extends object> {
  /** What the person sees and types; null until the settings come. */
  readonly form: Readonly<Ref<Form | null>>;
  /** What each field says, by its name on the server: the refusal's messages and the screen's. */
  readonly fieldErrors: Readonly<Ref<Readonly<Record<string, string>>>>;
  /** The person changed `field` to `value`. */
  set<K extends keyof Form>(field: K, value: Form[K]): void;
}
</script>

<script setup lang="ts" generic="Form extends object, Field extends SettingsTextField<Form>">
// A number field of a settings page, painted from what `useSettingsForm` gives. Its value is the form's, so a change
// saved elsewhere repaints it; what is typed goes to the form as text, and `useSettingsForm` sends it as a number when
// it is a whole one. The server's refusal for the field is said under it, by the field's name on the server.
import { IonInput } from '@ionic/vue';
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    /** What `useSettingsForm` returned (or the page's own `set` around it). */
    settings: SettingsNumberFieldState<Form>;
    /** The form field it paints: its name in the form and in a refusal. */
    field: Field;
    /** The field's label. */
    label: string;
    /** The `data-testid` of the box. */
    testid: string;
    /** What the field is for, under it. */
    helperText?: string;
    min?: number | string;
    max?: number | string;
    step?: string;
    /** The keyboard: whole numbers, or a figure with decimals. */
    inputmode?: 'numeric' | 'decimal';
    /** Whoever may not change the settings reads them. */
    disabled?: boolean;
  }>(),
  { helperText: undefined, min: undefined, max: undefined, step: undefined, inputmode: 'numeric', disabled: false },
);

const value = computed(() => String(props.settings.form.value?.[props.field] ?? ''));
const message = computed(() => props.settings.fieldErrors.value[String(props.field)]);

function onInput(typed: string | number | null | undefined): void {
  // `Field` holds text (`SettingsTextField`): what is typed is what the form keeps in it.
  props.settings.set(props.field, (typed === null || typed === undefined ? '' : String(typed)) as Form[Field]);
}
</script>

<template>
  <ion-input
    :data-testid="testid"
    :model-value="value"
    type="number"
    :inputmode="inputmode"
    :min="min"
    :max="max"
    :step="step"
    :label="label"
    :helper-text="helperText"
    label-placement="floating"
    fill="outline"
    mode="md"
    :disabled="disabled"
    :error-text="message"
    :class="{ 'ion-invalid': !!message, 'ion-touched': !!message }"
    @update:model-value="onInput"
  />
</template>
