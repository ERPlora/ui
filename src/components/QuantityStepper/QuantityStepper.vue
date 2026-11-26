<script setup lang="ts">
// How many of something: one less, the figure and one more (a line of a check, a dish of an order, an option picked
// twice). It only says what was asked (`change`, as the server reads a quantity: «2», «0.532»); the figure shows what
// the page keeps, so a refused quantity puts the field back by itself. Whole units unless `decimals`, where a weight
// or a time is typed in the reader's language («0,532») and shows its unit. The field holds the figure as a person
// types it, ungrouped («1500»). One less and one more wait at `min` and `max`.
import { IonButton } from '@ionic/vue';
import { computed, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { decimalMark } from '../format';
import { useComponentLocale } from '../locale';
import en from './locales/en.json';
import es from './locales/es.json';

const props = withDefaults(
  defineProps<{
    quantity: number | string;
    /** The unit the figure counts; none, or «ud», is not shown. */
    unit?: string;
    min?: number;
    max?: number;
    /** A figure with decimals may be typed (a weight); else whole units. */
    decimals?: boolean;
    disabled?: boolean;
    /** What the field counts, for a screen reader; «Quantity» by default. */
    label?: string;
    decreaseLabel?: string;
    increaseLabel?: string;
    /** Prefix of the `data-testid` hooks (`-minus`, `-field`, `-unit`, `-plus`). */
    testid?: string;
  }>(),
  {
    unit: '',
    min: 0,
    max: undefined,
    label: undefined,
    decreaseLabel: undefined,
    increaseLabel: undefined,
    testid: 'quantity-stepper',
  },
);
const emit = defineEmits<{ change: [quantity: string] }>();

const { t } = useI18n({ useScope: 'local', messages: { en, es } });
const locale = useComponentLocale();
const field = useTemplateRef<HTMLInputElement>('field');

const value = computed(() => Number(props.quantity));
/** The locale's decimal separator, as typed («,» in Spanish). */
const separator = computed(() => decimalMark(locale.value));
/** The figure as typed: without trailing zeros, the locale's mark, ungrouped. */
const shown = computed(() => String(value.value).replace('.', separator.value));
const lessDisabled = computed(() => props.disabled || value.value <= props.min);
const moreDisabled = computed(() => props.disabled || (props.max !== undefined && value.value >= props.max));

function reset(): void {
  if (field.value) field.value.value = shown.value;
}
watch([shown, () => props.disabled], reset);

/** Any decimals with `decimals`: the step of the unit is the server's to judge. */
const QUANTITY = computed(() => (props.decimals ? /^\d+(?:\.\d+)?$/ : /^\d+$/));

function within(next: number): boolean {
  return next >= props.min && (props.max === undefined || next <= props.max);
}

/** One less or one more, no further than the floor and the ceiling: one less of half a kilo asks none. */
function step(by: number): void {
  const next = Math.min(props.max ?? Infinity, Math.max(props.min, value.value + by));
  if (next !== value.value) emit('change', String(Math.round(next * 1000) / 1000));
}

function onChange(): void {
  const typed = (field.value?.value ?? '').trim().replace(separator.value, '.').replace(',', '.');
  if (!QUANTITY.value.test(typed) || Number(typed) === value.value || !within(Number(typed))) {
    reset();
    return;
  }
  emit('change', typed);
}
</script>

<template>
  <span
    class="ep-quantity"
    @click.stop
  >
    <ion-button
      fill="clear"
      class="ep-quantity__btn"
      :data-testid="`${testid}-minus`"
      :aria-label="decreaseLabel ?? t('quantityStepper.less')"
      :disabled="lessDisabled"
      @click="step(-1)"
    >
      <span aria-hidden="true">−</span>
    </ion-button>
    <input
      ref="field"
      class="ep-quantity__field"
      type="text"
      :inputmode="decimals ? 'decimal' : 'numeric'"
      :value="shown"
      :aria-label="label ?? t('quantityStepper.quantity')"
      :disabled="disabled"
      :data-testid="`${testid}-field`"
      @change="onChange"
      @keydown.enter="($event.target as HTMLInputElement).blur()"
    >
    <span
      v-if="unit && unit !== 'ud'"
      class="ep-quantity__unit"
      :data-testid="`${testid}-unit`"
    >{{ unit }}</span>
    <ion-button
      fill="clear"
      class="ep-quantity__btn"
      :data-testid="`${testid}-plus`"
      :aria-label="increaseLabel ?? t('quantityStepper.more')"
      :disabled="moreDisabled"
      @click="step(1)"
    >
      <span aria-hidden="true">+</span>
    </ion-button>
  </span>
</template>

<style scoped>
.ep-quantity {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  overflow: hidden;
  background: var(--ion-card-background);
  border: 1px solid var(--ep-border);
  border-radius: 10px;
}
/* A touch target of 44 px: Ionic's iOS button is at least 3.1em high otherwise, which beats a `height`. */
.ep-quantity__btn {
  width: 2.75rem;
  height: 2.75rem;
  min-height: 2.75rem;
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
  --color: var(--ion-text-color);
  --padding-start: 0;
  --padding-end: 0;
}
.ep-quantity__btn:disabled,
.ep-quantity__btn[disabled] {
  opacity: 0.4;
}
/* As wide as the figure it holds, so a weight reads whole («0,532»). */
.ep-quantity__field {
  field-sizing: content;
  min-width: 2.3rem;
  height: 2.75rem;
  padding: 0 0.35rem;
  font: inherit;
  font-weight: 700;
  text-align: center;
  color: inherit;
  background: transparent;
  border: none;
  border-inline: 1px solid var(--ep-border);
}
/* Without field-sizing (before Chrome 123, Safari 26.2 and Firefox 152) a text field is twenty characters wide. */
@supports not (field-sizing: content) {
  .ep-quantity__field {
    width: 2.3rem;
  }
}
.ep-quantity__unit {
  padding: 0 0.25rem;
  font-size: 0.72rem;
  color: var(--ion-color-medium);
}
</style>
