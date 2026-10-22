<script setup lang="ts">
// ColorInput — one colour of a form (a website's brand colours), the way Shopify's theme editor and
// WordPress's customizer ask for it: a swatch that opens the system palette next to the hex text.
//   <ColorInput v-model="site.primary_color" :label="t('website.primaryColor')" />
// Contract:
//   - `v-model` is a `#rrggbb` string. An `ion-item` holds the native `<input type="color">` swatch
//     and an `ion-input` (label stacked above, iOS by default) with the hex text.
//   - The text reaches the page only as a valid colour: `#RRGGBB` or `RRGGBB`, any case, spaces
//     around → `#rrggbb`. A wrong text emits nothing; once the person leaves the field it paints the
//     field invalid with its reason (Ionic's error text), and that goes as soon as the text is right.
//   - The swatch emits what is picked while it is being picked (the preview follows it).
//   - A page value that is not a colour keeps its text and paints the swatch black.
import { IonInput, IonItem } from '@ionic/vue';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import en from './locales/en.json';
import es from './locales/es.json';

const props = withDefaults(
  defineProps<{
    /** The colour (`v-model`), `#rrggbb`. */
    modelValue: string;
    /** The field's label, and the swatch's name. */
    label: string;
    disabled?: boolean;
    /** Prefix of the `data-testid` hooks (`<testid>` on the ion-input, `-swatch`). */
    testid?: string;
  }>(),
  { disabled: false, testid: undefined },
);

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const { t } = useI18n({ useScope: 'local', messages: { en, es } });

const HEX = /^#?([0-9a-f]{6})$/i;

/** `#rrggbb` for a text that is a colour, `null` otherwise. */
function toColor(value: string): string | null {
  const match = HEX.exec(value.trim());
  return match ? `#${match[1].toLowerCase()}` : null;
}

const tid = (part: string): string | undefined => (props.testid?.trim() ? `${props.testid.trim()}-${part}` : undefined);

/** What the text field shows: the page's value, or what the person is typing. */
const text = ref(props.modelValue ?? '');
/** The person left the field (Ionic paints the error text only on a touched field). */
const touched = ref(false);

const invalid = computed(() => toColor(text.value) === null);
const showError = computed(() => touched.value && invalid.value);
/** The native colour input only takes `#rrggbb`: anything else paints black. */
const swatchValue = computed(() => toColor(props.modelValue ?? '') ?? '#000000');

watch(
  () => props.modelValue,
  (value) => {
    text.value = value ?? '';
    touched.value = false;
  },
);

function onText(ev: CustomEvent<{ value?: string | null }>): void {
  if (props.disabled) return;
  text.value = ev.detail.value ?? '';
  const color = toColor(text.value);
  if (color !== null && color !== props.modelValue) emit('update:modelValue', color);
}

function onLeave(): void {
  touched.value = true;
}

function onSwatch(ev: Event): void {
  if (props.disabled) return;
  const color = toColor((ev.target as HTMLInputElement).value);
  if (color === null) return;
  text.value = color;
  emit('update:modelValue', color);
}
</script>

<template>
  <ion-item
    class="color-input"
    lines="none"
  >
    <input
      class="color-input__swatch"
      type="color"
      :value="swatchValue"
      :disabled="disabled"
      :aria-label="t('colorInput.swatch', { label })"
      :data-testid="tid('swatch')"
      @input="onSwatch"
    >
    <ion-input
      class="color-input__text"
      :class="{ 'ion-invalid': showError, 'ion-touched': showError }"
      label-placement="stacked"
      :label="label"
      :value="text"
      :disabled="disabled"
      :maxlength="9"
      autocapitalize="off"
      autocomplete="off"
      :spellcheck="false"
      :error-text="showError ? t('colorInput.invalid') : undefined"
      :data-testid="testid"
      @ion-input="onText"
      @ion-blur="onLeave"
    />
  </ion-item>
</template>

<style scoped>
.color-input {
  --inner-padding-end: 0;
}
/* The swatch: a tap target of its own, a round-cornered well of the colour. */
.color-input__swatch {
  flex: 0 0 auto;
  inline-size: var(--ep-tap-min, 44px);
  block-size: var(--ep-tap-min, 44px);
  margin-inline-end: 0.75rem;
  padding: 0;
  border: 1px solid var(--ion-color-step-200, rgba(0, 0, 0, 0.15));
  border-radius: var(--ep-radius-sm, 6px);
  background: none;
  cursor: pointer;
}
.color-input__swatch::-webkit-color-swatch-wrapper {
  padding: 3px;
}
.color-input__swatch::-webkit-color-swatch {
  border: 0;
  border-radius: calc(var(--ep-radius-sm, 6px) - 2px);
}
.color-input__swatch::-moz-color-swatch {
  border: 0;
  border-radius: calc(var(--ep-radius-sm, 6px) - 2px);
}
.color-input__swatch:disabled {
  cursor: default;
  opacity: 0.5;
}
.color-input__text {
  flex: 1 1 auto;
  min-width: 0;
}
</style>
