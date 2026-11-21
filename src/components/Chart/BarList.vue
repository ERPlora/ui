<script setup lang="ts">
// A ranked list of names, each with its value as the page wrote it and a bar as long as its share of the largest
// value (a value below zero by its size, marked negative). The list is what a screen reader reads; the bars are only
// for the eye. Its look is the theme sheet charts.css.
//   <BarList :items="channels.map((c) => ({ label: c.name, value: c.total, text: formatMoney(c.total, locale, money) }))"
//            :tone="1" :description="t('sales.byChannel')" />
import { computed } from 'vue';

import ChartFrame from './ChartFrame.vue';
import { percent } from './model';
import type { BarListItem, ChartTone } from './types';

const props = withDefaults(
  defineProps<{
    items: readonly BarListItem[];
    /** The colour of every row that does not ask for its own. */
    tone?: ChartTone;
    description?: string;
    loading?: boolean;
    error?: boolean;
    emptyLabel?: string;
    testid?: string;
  }>(),
  { tone: 1, description: undefined, loading: false, error: false, emptyLabel: undefined, testid: undefined },
);

const emit = defineEmits<{ retry: [] }>();

const rows = computed(() => {
  const largest = Math.max(0, ...props.items.map((item) => Math.abs(item.value ?? 0)));
  return props.items.map((item) => ({
    item,
    fill:
      item.value === null
        ? undefined
        : {
            tone: item.tone ?? props.tone,
            sign: item.value < 0 ? 'negative' : 'positive',
            width: percent(largest > 0 ? Math.abs(item.value) / largest : 0),
          },
  }));
});
</script>

<template>
  <ChartFrame
    kind="list"
    :drawable="items.length > 0"
    :description="description"
    :loading="loading"
    :error="error"
    :empty-label="emptyLabel"
    :testid="testid"
    @retry="emit('retry')"
  >
    <ul class="ep-chart__list">
      <li
        v-for="(row, index) in rows"
        :key="index"
        class="ep-chart__row"
      >
        <span class="ep-chart__name">{{ row.item.label }}</span>
        <span
          class="ep-chart__track"
          aria-hidden="true"
        ><span
          v-if="row.fill"
          class="ep-chart__fill"
          :data-tone="row.fill.tone"
          :data-sign="row.fill.sign"
          :style="{ width: row.fill.width }"
        /></span>
        <span class="ep-chart__value">{{ row.item.text }}</span>
      </li>
    </ul>
  </ChartFrame>
</template>
