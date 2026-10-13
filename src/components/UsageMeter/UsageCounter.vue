<script setup lang="ts">
// UsageCounter — a figure of the «Usage» card of a business, next to the UsageMeter (mockups
// `business.html`: «Activos ayer 3», «Últimos 30 días 4»; the old `.kpi-card` of the panel): a
// small label, a big number in the person's language and an optional hint. The page lays two or
// more side by side.
//   <UsageCounter :label="t('usage.activeYesterday')" :value="usage.activeUsers1d" />
// A number is formatted in `locale`, else the app's vue-i18n locale, else `<html lang>`, else the
// browser's; a text value is shown as it comes. Contrast: `UsageMeter.contrast.test.ts`.
import { computed } from 'vue';

import { useComponentLocale } from '../locale';
import { formatUsageNumber } from './usage';

const props = withDefaults(
  defineProps<{
    /** What is counted («Active yesterday»). */
    label: string;
    /** The figure: a number (formatted) or a text (as it comes). */
    value: number | string;
    /** A line below the number. */
    hint?: string;
    /** Language of the number; by default, the person's. */
    locale?: string;
  }>(),
  { hint: undefined, locale: undefined },
);

const locale = useComponentLocale(() => props.locale);
const shownValue = computed(() =>
  typeof props.value === 'number' ? formatUsageNumber(props.value, locale.value) : props.value,
);
</script>

<template>
  <div class="usage-counter">
    <span class="usage-counter__label">{{ label }}</span>
    <span class="usage-counter__value">{{ shownValue }}</span>
    <span
      v-if="hint"
      class="usage-counter__hint"
    >{{ hint }}</span>
  </div>
</template>

<style scoped>
.usage-counter {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
  padding: 0.75rem 0.9rem;
  border: 1px solid color-mix(in srgb, var(--ion-text-color, #000) 8%, transparent);
  border-radius: var(--ep-radius-sm, 10px);
  background: var(--ion-background-color, #fff);
}
.usage-counter__label {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 10.5px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--ep-text-muted, var(--ion-color-medium, #636469));
}
.usage-counter__value {
  font-size: 1.4rem;
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--ion-text-color, #000);
}
.usage-counter__hint {
  font-size: 0.8rem;
  line-height: 1.45;
  color: var(--ep-text-muted, var(--ion-color-medium, #636469));
}
</style>
