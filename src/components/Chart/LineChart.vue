<script setup lang="ts">
// Values per label as lines on a round scale from zero, each point over the middle of its label; the first series is
// shaded down to the zero line and a missing value breaks its line. Its look is the theme sheet charts.css.
//   <LineChart :labels="hours" :series="[{ label: t('sales.today'), values: today },
//              { label: t('sales.lastWeekday'), values: lastWeek }]" :format="(v) => formatMoney(v, locale, money)"
//              :description="t('sales.byHourSummary', { peak })" />
import { computed } from 'vue';

import ChartFrame from './ChartFrame.vue';
import ChartPlot from './ChartPlot.vue';
import { drawnSeries, hasValues } from './model';
import { lineSegments, niceScale, position, toPoints } from './scale';
import type { ChartProps } from './types';

const props = withDefaults(defineProps<ChartProps>(), {
  format: undefined,
  loading: false,
  error: false,
  emptyLabel: undefined,
  testid: undefined,
});

const emit = defineEmits<{ retry: [] }>();

const series = computed(() => drawnSeries(props.series, 'line'));
const scale = computed(() => niceScale(series.value.flatMap((item) => item.values)));

const lines = computed(() =>
  series.value.flatMap((item, index) =>
    lineSegments(item.values, scale.value).map((segment, part) => ({ key: `${index}-${part}`, item, index, segment })),
  ),
);

/** The shade under the first series: each of its lines closed down to the zero line. */
const shades = computed(() => {
  const zero = Math.round((1 - position(0, scale.value)) * 10000) / 100;
  return lines.value
    .filter(({ index }) => index === 0)
    .map(({ key, item, segment }) => ({
      key,
      item,
      points: toPoints([...segment, [segment[segment.length - 1][0], zero], [segment[0][0], zero]]),
    }));
});
</script>

<template>
  <ChartFrame
    kind="line"
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
      mark="line"
      :description="description"
      :format="format"
    >
      <svg
        class="ep-chart__lines"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <polygon
          v-for="shade in shades"
          :key="shade.key"
          class="ep-chart__shade"
          :data-tone="shade.item.tone"
          :points="shade.points"
        />
        <polyline
          v-for="line in lines"
          :key="line.key"
          class="ep-chart__line"
          :data-tone="line.item.tone"
          :data-pattern="line.item.pattern"
          :points="toPoints(line.segment)"
          vector-effect="non-scaling-stroke"
        />
      </svg>
    </ChartPlot>
  </ChartFrame>
</template>
