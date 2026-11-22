<script setup lang="ts">
// A day of a form. `v-model` is the ISO day, `YYYY-MM-DD` ('' or null for none): shown in the numeric date of the
// app's language and picked in Ionic's calendar, in a popover anchored to the field.
import { computed } from 'vue';

import { useComponentLocale } from '../locale';
import PickerField from './PickerField.vue';
import { formatDay, isoDay } from './pickerValues';

const props = defineProps<{
  /** The day, `YYYY-MM-DD`; '' or null for none. */
  modelValue?: string | null;
  label: string;
  /** The `data-testid` of the ion-input. */
  testid: string;
  /** The first day that can be picked, `YYYY-MM-DD`. */
  min?: string;
  /** The last day that can be picked, `YYYY-MM-DD`. */
  max?: string;
  /** No Clear in the calendar. */
  required?: boolean;
  disabled?: boolean;
  /** The server's message for the field. */
  errorText?: string;
  helperText?: string;
  /** The field's name in the form, and in a refusal of the server. */
  name?: string;
  /** A control of a row of filters, which styles it: no outline nor painted label (the label is its accessible name). */
  compact?: boolean;
  /** What it reads while empty. */
  placeholder?: string;
}>();
/** The picked day, or '' once cleared. */
const emit = defineEmits<{ 'update:modelValue': [day: string] }>();

const locale = useComponentLocale();
const text = computed(() => formatDay(props.modelValue ?? '', locale.value));
</script>

<template>
  <PickerField
    :label="label"
    :testid="testid"
    :text="text"
    icon="ion:calendar-outline"
    presentation="date"
    :value="modelValue ?? ''"
    :min="min"
    :max="max"
    :required="required"
    :disabled="disabled"
    :error-text="errorText"
    :helper-text="helperText"
    :name="name"
    :compact="compact"
    :placeholder="placeholder"
    @pick="emit('update:modelValue', isoDay($event))"
  />
</template>
