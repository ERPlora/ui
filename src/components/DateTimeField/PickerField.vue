<script setup lang="ts">
// The field DateField and TimeField share: read-only and outlined like the other fields of a form (or bare, for a row
// of filters that styles it), it shows the value as the person reads it and opens Ionic's own picker, ion-datetime,
// in a popover anchored to it, with Done, Cancel and, unless the field is required, Clear. Never the device's native
// picker, which paints in its own colours and language.
import { IonDatetime, IonInput, IonPopover } from '@ionic/vue';
import { computed, ref, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';

import HubIcon from '../../shell/HubIcon.vue';
import { useComponentLocale } from '../locale';
import en from './locales/en.json';
import es from './locales/es.json';
import { firstDayOfWeek } from './pickerValues';

const props = defineProps<{
  label: string;
  /** The `data-testid` of the ion-input. */
  testid?: string;
  /** The value as the person reads it. */
  text: string;
  /** The icon at the end of the field, `set:name`. */
  icon: string;
  presentation: 'date' | 'time';
  /** The value ion-datetime opens on (ISO); empty for none. */
  value?: string;
  min?: string;
  max?: string;
  /** ion-datetime's `minuteValues`. */
  minuteValues?: string;
  required?: boolean;
  disabled?: boolean;
  errorText?: string;
  helperText?: string;
  /** The field's name in the form, and in a refusal of the server. */
  name?: string;
  /** A control of a row of filters, which styles it: no outline nor painted label (the label is its accessible name). */
  compact?: boolean;
  /** What it reads while empty. */
  placeholder?: string;
}>();

const emit = defineEmits<{ pick: [value: string | null] }>();

const { t } = useI18n({ useScope: 'local', messages: { en, es } });
const locale = useComponentLocale();
const weekStart = computed(() => firstDayOfWeek(locale.value));

const field = ref<InstanceType<typeof IonInput>>();
const open = ref(false);
/** Where the popover anchors: the field itself (Ionic reads `event.target`). */
const anchor = shallowRef<Event | undefined>(undefined);

const OPENING_KEYS = new Set(['Enter', ' ', 'ArrowDown']);

function show(): void {
  if (props.disabled || open.value) return;
  anchor.value = { target: field.value?.$el } as unknown as Event;
  open.value = true;
}

function onKeydown(event: KeyboardEvent): void {
  if (!OPENING_KEYS.has(event.key) || props.disabled) return;
  event.preventDefault();
  show();
}

/** Done or Clear: the value goes to the page, and the form around the field hears a native `input`, as from a
 *  typed field. Clear leaves nothing to choose, so the picker closes. */
function onChange(event: CustomEvent<{ value?: string | string[] | null }>): void {
  const value = typeof event.detail.value === 'string' && event.detail.value ? event.detail.value : null;
  emit('pick', value);
  field.value?.$el.dispatchEvent(new Event('input', { bubbles: true }));
  if (value === null) open.value = false;
}
</script>

<template>
  <div class="ep-picker-field">
    <ion-input
      ref="field"
      :data-testid="testid"
      :model-value="text"
      :readonly="true"
      :label="compact ? undefined : label"
      :aria-label="compact ? label : undefined"
      label-placement="floating"
      :fill="compact ? undefined : 'outline'"
      mode="md"
      :placeholder="placeholder"
      :name="name"
      :required="required"
      :disabled="disabled"
      :helper-text="helperText"
      :error-text="errorText"
      :class="{ 'ion-invalid': !!errorText, 'ion-touched': !!errorText }"
      aria-haspopup="dialog"
      @click="show"
      @keydown="onKeydown"
    >
      <HubIcon
        slot="end"
        class="ep-picker-field__icon"
        :name="icon"
      />
    </ion-input>
    <ion-popover
      :class="['ep-picker-field__popover', `ep-picker-field__popover--${presentation}`]"
      :is-open="open"
      :event="anchor"
      side="bottom"
      alignment="start"
      @did-dismiss="open = false"
    >
      <ion-datetime
        :presentation="presentation"
        :value="value || undefined"
        :min="min"
        :max="max"
        :minute-values="minuteValues"
        :prefer-wheel="presentation === 'time'"
        :locale="locale"
        :first-day-of-week="weekStart"
        :show-default-buttons="true"
        :show-clear-button="!required"
        :done-text="t('dateTimeField.done')"
        :cancel-text="t('dateTimeField.cancel')"
        :clear-text="t('dateTimeField.clear')"
        @ion-change="onChange"
      />
    </ion-popover>
  </div>
</template>

<style scoped>
.ep-picker-field ion-input {
  cursor: pointer;
}
.ep-picker-field__icon {
  color: var(--ep-text-muted);
  pointer-events: none;
}
/* The arrow in the colour of the picker under it (ion-datetime's own background), not the page's. */
.ep-picker-field__popover::part(arrow)::after {
  background: var(--ion-color-light);
}
/* ion-datetime draws its month 350 px wide; a phone gives it its width less a margin. */
.ep-picker-field__popover--date {
  --width: min(350px, calc(100vw - 16px));
}
.ep-picker-field__popover--time {
  --width: 16rem;
}
</style>
