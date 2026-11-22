<script setup lang="ts">
// A day and a time of a form as one value: `v-model` is `YYYY-MM-DDTHH:MM` ('' or null for none), picked in a
// DateField (under the field's label) and a TimeField side by side. Until both hold something the value is '', as a
// half-typed native field; the half already picked stays on screen.
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import DateField from './DateField.vue';
import en from './locales/en.json';
import es from './locales/es.json';
import TimeField from './TimeField.vue';

const props = defineProps<{
  /** The day and the time, `YYYY-MM-DDTHH:MM` (seconds are ignored); '' or null for none. */
  modelValue?: string | null;
  /** The day's label, and the name of the pair. */
  label: string;
  /** The `data-testid` of the pair; its fields carry `<testid>-date` and `<testid>-time`. */
  testid: string;
  /** The time's wheel offers the minutes every this many from the hour; every minute without it. */
  minuteStep?: number;
  /** No Clear in either picker. */
  required?: boolean;
  disabled?: boolean;
  /** The server's message for the value, under the day. */
  errorText?: string;
  helperText?: string;
  /** The value's name in the form, and in a refusal of the server: both fields carry it. */
  name?: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const { t } = useI18n({ useScope: 'local', messages: { en, es } });

const day = ref('');
const time = ref('');
const joined = (): string => (day.value && time.value ? `${day.value}T${time.value}` : '');

watch(
  () => props.modelValue ?? '',
  (value) => {
    if (value === joined()) return;
    const [date = '', clock = ''] = value.split('T');
    day.value = date;
    time.value = clock.slice(0, 5);
  },
  { immediate: true },
);

function pickDay(value: string): void {
  day.value = value;
  emit('update:modelValue', joined());
}

function pickTime(value: string): void {
  time.value = value;
  emit('update:modelValue', joined());
}
</script>

<template>
  <div
    class="ep-date-time-field"
    role="group"
    :aria-label="label"
    :data-testid="testid"
  >
    <DateField
      :model-value="day"
      :label="label"
      :testid="`${testid}-date`"
      :required="required"
      :disabled="disabled"
      :error-text="errorText"
      :helper-text="helperText"
      :name="name"
      @update:model-value="pickDay"
    />
    <TimeField
      :model-value="time"
      :label="t('dateTimeField.time')"
      :testid="`${testid}-time`"
      :minute-step="minuteStep"
      :required="required"
      :disabled="disabled"
      :name="name"
      @update:model-value="pickTime"
    />
  </div>
</template>

<style scoped>
/* Side by side while both fit their value and a long label; one under the other on a phone. */
.ep-date-time-field {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(11.5rem, 1fr));
  gap: 0.5rem 0.75rem;
  align-items: start;
}
</style>
