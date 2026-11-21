<script setup lang="ts">
// Values per label as vertical bars, one per series side by side, on a round scale from zero; a value below zero
// hangs down from the zero line. Its look is the theme sheet charts.css.
//   <BarChart :labels="days" :series="[{ label: t('sales.thisWeek'), values: thisWeek },
//             { label: t('sales.lastWeek'), values: lastWeek }]" :format="(v) => formatMoney(v, locale, money)"
//             :description="t('sales.byDaySummary', { best })" />
import ChartPlot from './ChartPlot.vue';
import { barGroups } from './model';
import type { ChartProps } from './types';

defineProps<ChartProps>();

const emit = defineEmits<{ retry: [] }>();
</script>

<template>
  <ChartPlot
    v-bind="$props"
    mark="bar"
    @retry="emit('retry')"
  >
    <template #default="{ series, scale }">
      <div class="ep-chart__bars">
        <div
          v-for="(group, index) in barGroups(labels, series, scale)"
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
    </template>
  </ChartPlot>
</template>
