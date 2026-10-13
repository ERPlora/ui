<script setup lang="ts">
// UsageMeter — the labelled bar of the «Usage» card of a business (mockups `business.html`, Summary
// tab; the part of OutfitKit's `ok-resource-usage` the panel keeps): the label and how full on top
// («Almacenamiento · 1,2 GB de 10 GB · 12 %»), the bar, an optional hint below. Next to it, the
// card's figures go in UsageCounter.
//   <UsageMeter :label="t('usage.storage')" :value="usage.storageGb" :max="plan.storageGb" unit="GB"
//               :hint="t('usage.storageHint')" />
// Contract:
//   - How full: `percent` when given, else `value / max` (`usage.ts`). Over the limit the text says
//     so (110 %) and the bar stops full.
//   - Tone: green under 70 %, amber from 70 %, red from 90 %; `tone` overrides it.
//   - The amount («1,2 GB de 10 GB») only with `value` and `max`. Numbers in `locale`, else the
//     app's vue-i18n locale, else `<html lang>`, else the browser's.
//   - The bar is a `progressbar` named by the label (0–100, its text = what the meter shows) and
//     described by the hint.
// Colours (`UsageMeter.contrast.test.ts`): the fill reaches 3:1 against the surface and its empty
// track, every tone, light and dark; the texts reach 4.5:1.
import { computed, useId } from 'vue';

import { useComponentLocale } from '../locale';
import type { UsageMeterSize, UsageMeterTone } from './types';
import { formatUsagePercent, formatUsageValue, usagePercent, usageTone } from './usage';

const props = withDefaults(
  defineProps<{
    /** What is measured («Storage»), and the bar's accessible name. */
    label: string;
    /** The amount used, in `unit`. */
    value?: number | null;
    /** The limit, in `unit`. */
    max?: number | null;
    /** How full, in percent, when there is no amount to show. */
    percent?: number | null;
    /** Unit of `value` and `max` («GB»), already in the person's language. */
    unit?: string;
    /** Colour; by default, from how full it is. */
    tone?: UsageMeterTone;
    /** A line below the bar («Photos, documents and backups»). */
    hint?: string;
    /** `md` is the meter of the mockups; `sm` is thinner. */
    size?: UsageMeterSize;
    /** Language of the numbers; by default, the person's. */
    locale?: string;
  }>(),
  {
    value: undefined,
    max: undefined,
    percent: undefined,
    unit: undefined,
    tone: undefined,
    hint: undefined,
    size: 'md',
    locale: undefined,
  },
);

const locale = useComponentLocale(() => props.locale);
const hintId = `ep-usage-meter-hint-${useId()}`;

const percentUsed = computed(() =>
  usagePercent({ value: props.value, max: props.max, percent: props.percent }),
);
/** The bar and the progress bar stop at full; the text does not. */
const filled = computed(() => Math.min(100, percentUsed.value));
const shownTone = computed<UsageMeterTone>(() => props.tone ?? usageTone(percentUsed.value));
const percentText = computed(() => formatUsagePercent(percentUsed.value, locale.value));
const valueText = computed(() =>
  typeof props.value === 'number' && typeof props.max === 'number'
    ? formatUsageValue(props.value, props.max, props.unit, locale.value)
    : '',
);
const valueNow = computed(() => Math.round(filled.value));
const ariaText = computed(() => (valueText.value ? `${valueText.value} (${percentText.value})` : percentText.value));
</script>

<template>
  <div
    class="usage-meter"
    :data-tone="shownTone"
    :data-size="size"
  >
    <div class="usage-meter__head">
      <span class="usage-meter__label">{{ label }}</span>
      <span class="usage-meter__figures">
        <span
          v-if="valueText"
          class="usage-meter__value"
        >{{ valueText }}</span>
        <span class="usage-meter__percent">{{ percentText }}</span>
      </span>
    </div>
    <div
      class="usage-meter__track"
      role="progressbar"
      :aria-label="label"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="valueNow"
      :aria-valuetext="ariaText"
      :aria-describedby="hint ? hintId : undefined"
    >
      <div
        class="usage-meter__fill"
        :style="{ width: `${filled}%` }"
      />
    </div>
    <span
      v-if="hint"
      :id="hintId"
      class="usage-meter__hint"
    >{{ hint }}</span>
  </div>
</template>

<style scoped>
.usage-meter {
  /* The tone (green by default) and how much of it the fill takes, darkened in light and lightened
     in dark; a tone rule below reassigns them, a size rule the bar's height. */
  --usage-meter-height: 8px;
  --usage-meter-tone: var(--ep-success, var(--ion-color-success, #2dd55b));
  --usage-meter-shade: 90%;
  --usage-meter-shade-dark: 90%;

  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  min-width: 0;
}

.usage-meter[data-tone='warning'] {
  --usage-meter-tone: var(--ep-warning, var(--ion-color-warning, #ffc409));
  --usage-meter-shade: 62%;
  --usage-meter-shade-dark: 100%;
}
.usage-meter[data-tone='danger'] {
  --usage-meter-tone: var(--ep-danger, var(--ion-color-danger, #c5000f));
  --usage-meter-shade: 100%;
  --usage-meter-shade-dark: 80%;
}

.usage-meter[data-size='sm'] {
  --usage-meter-height: 6px;
  gap: 0.3rem;
}

.usage-meter__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}
.usage-meter__label {
  min-width: 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ion-text-color, #000);
}
.usage-meter__figures {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.25rem 0.6rem;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.usage-meter__value {
  color: var(--ep-text-muted, var(--ion-color-medium, #636469));
}
.usage-meter__percent {
  color: var(--ep-text-muted, var(--ion-color-medium, #636469));
}
.usage-meter[data-size='sm'] .usage-meter__label { font-size: 0.8rem; }
.usage-meter[data-size='sm'] .usage-meter__figures { font-size: 0.75rem; }

.usage-meter__track {
  height: var(--usage-meter-height);
  border-radius: var(--ep-radius-pill, 999px);
  overflow: hidden;
  background: color-mix(in srgb, var(--ion-text-color, #000) 8%, transparent);
}
.usage-meter__fill {
  height: 100%;
  border-radius: var(--ep-radius-pill, 999px);
  background: color-mix(in srgb, var(--usage-meter-tone) var(--usage-meter-shade), black);
  transition: width 0.3s ease;
}
:root.ion-palette-dark .usage-meter__fill {
  background: color-mix(in srgb, var(--usage-meter-tone) var(--usage-meter-shade-dark), white);
}
@media (prefers-reduced-motion: reduce) {
  .usage-meter__fill { transition: none; }
}

.usage-meter__hint {
  display: block;
  font-size: 0.8rem;
  line-height: 1.45;
  color: var(--ep-text-muted, var(--ion-color-medium, #636469));
}
</style>
