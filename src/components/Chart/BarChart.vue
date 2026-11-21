<script setup lang="ts">
// Values per label as vertical bars, one per series side by side, on a round scale from zero; a value below zero
// hangs down from the zero line. Its look is the theme sheet charts.css.
//   <BarChart :labels="days" :series="[{ label: t('sales.thisWeek'), values: thisWeek },
//             { label: t('sales.lastWeek'), values: lastWeek }]" :format="(v) => formatMoney(v, locale, money)"
//             :description="t('sales.byDaySummary', { best })" />
import { computed } from 'vue';

import ChartFrame from './ChartFrame.vue';
import ChartPlot from './ChartPlot.vue';
import { drawnSeries, hasValues, percent } from './model';
import { barSpan, niceScale } from './scale';
import type { ChartProps } from './types';

const props = withDefaults(defineProps<ChartProps>(), {
  format: undefined,
  loading: false,
  error: false,
  emptyLabel: undefined,
  testid: undefined,
});

const emit = defineEmits<{ retry: [] }>();

const series = computed(() => drawnSeries(props.series, 'bar'));
const scale = computed(() => niceScale(series.value.flatMap((item) => item.values)));

/** Each label's bars, one per series; a missing value keeps its place in the group with no bar. */
const groups = computed(() =>
  props.labels.map((_label, index) =>
    series.value.map((item) => {
      const value = item.values[index] ?? null;
      if (value === null) return { item, bar: undefined };
      const span = barSpan(value, scale.value);
      return {
        item,
        bar: { sign: value < 0 ? 'negative' : 'positive', style: { bottom: percent(span.start), height: percent(span.size) } },
      };
    }),
  ),
);
</script>

<template>
  <ChartFrame
    kind="bars"
    :drawable="hasValues(labels, props.series)"
    :description="description"
    :loading="loading"
    :error="error"
    :empty-label="emptyLabel"
    :testid="testid"
    @retry="emit('retry')"
  >
    <ChartPlot
      :labels="labels"
      :series="series"
      :scale="scale"
      mark="bar"
      :description="description"
      :format="format"
    >
      <div class="ep-chart__bars">
        <div
          v-for="(group, index) in groups"
          :key="index"
          class="ep-chart__group"
        >
          <span
            v-for="{ item, bar } in group"
            :key="item.label"
            class="ep-chart__slot"
          ><span
            v-if="bar"
            class="ep-chart__bar"
            :data-tone="item.tone"
            :data-pattern="item.pattern"
            :data-sign="bar.sign"
            :style="bar.style"
          /></span>
        </div>
      </div>
    </ChartPlot>
  </ChartFrame>
</template>
