<script setup lang="ts">
// Values per label as lines on a round scale from zero, each point over the middle of its label; the first series is
// shaded down to the zero line and a missing value breaks its line. Its look is the theme sheet charts.css.
//   <LineChart :labels="hours" :series="[{ label: t('sales.today'), values: today },
//              { label: t('sales.lastWeekday'), values: lastWeek }]" :format="(v) => formatMoney(v, locale, money)"
//              :description="t('sales.byHourSummary', { peak })" />
import ChartPlot from './ChartPlot.vue';
import { linePaths, lineShades } from './model';
import type { ChartProps } from './types';

defineProps<ChartProps>();

const emit = defineEmits<{ retry: [] }>();
</script>

<template>
  <ChartPlot
    v-bind="$props"
    mark="line"
    @retry="emit('retry')"
  >
    <template #default="{ series, scale }">
      <svg
        class="ep-chart__lines"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <polygon
          v-for="shade in lineShades(series, scale)"
          :key="shade.key"
          class="ep-chart__shade"
          :data-tone="shade.item.tone"
          :points="shade.points"
        />
        <polyline
          v-for="line in linePaths(series, scale)"
          :key="line.key"
          class="ep-chart__line"
          :data-tone="line.item.tone"
          :data-pattern="line.item.pattern"
          :points="line.points"
          vector-effect="non-scaling-stroke"
        />
      </svg>
    </template>
  </ChartPlot>
</template>
