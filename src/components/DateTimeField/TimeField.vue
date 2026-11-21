<script setup lang="ts">
// A time of a form. `v-model` is `HH:MM` ('' or null for none): shown on the clock of the app's language (24 hours
// or AM/PM) and picked in Ionic's time wheel, in a popover anchored to the field.
import { computed } from 'vue';

import { useComponentLocale } from '../locale';
import PickerField from './PickerField.vue';
import { formatTime, isoTime, minuteValues, todayAt } from './pickerValues';

const props = defineProps<{
  /** The time, `HH:MM`; '' or null for none. */
  modelValue?: string | null;
  label: string;
  /** The `data-testid` of the ion-input. */
  testid: string;
  /** The first time that can be picked, `HH:MM`. */
  min?: string;
  /** The last time that can be picked, `HH:MM`. */
  max?: string;
  /** The wheel offers the minutes every this many from the hour (15: 00, 15, 30, 45); every minute without it. */
  minuteStep?: number;
  /** No Clear in the wheel. */
  required?: boolean;
  disabled?: boolean;
  /** The server's message for the field. */
  errorText?: string;
  helperText?: string;
  /** The field's name in the form, and in a refusal of the server. */
  name?: string;
}>();
/** The picked time, or '' once cleared. */
const emit = defineEmits<{ 'update:modelValue': [time: string] }>();

const locale = useComponentLocale();
const text = computed(() => formatTime(props.modelValue ?? '', locale.value));
const minutes = computed(() => minuteValues(props.minuteStep));
</script>

<template>
  <PickerField
    :label="label"
    :testid="testid"
    :text="text"
    icon="ion:time-outline"
    presentation="time"
    :value="todayAt(modelValue ?? '') ?? ''"
    :min="todayAt(min)"
    :max="todayAt(max)"
    :minute-values="minutes"
    :required="required"
    :disabled="disabled"
    :error-text="errorText"
    :helper-text="helperText"
    :name="name"
    @pick="emit('update:modelValue', isoTime($event))"
  />
</template>
