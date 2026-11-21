<script setup lang="ts">
// The parts the bar and the line chart share around their marks: the legend (two series or more), the value axis with
// its rules, the labels along the bottom and, for a screen reader, the table of the same values. The marks go in the
// slot, drawn over the rules. The drawing is hidden from a screen reader, which reads the table instead.
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { formatQuantity } from '../format';
import type { ChartMark, DrawnSeries } from './model';
import type { Scale } from './scale';

const props = defineProps<{
  labels: readonly string[];
  series: readonly DrawnSeries[];
  scale: Scale;
  mark: ChartMark;
  description: string;
  format?: (value: number) => string;
}>();

const { locale } = useI18n();

const write = computed(() => props.format ?? ((value: number) => formatQuantity(value, locale.value)));
const cell = (value: number | null | undefined): string => (value === null || value === undefined ? '—' : write.value(value));
</script>

<template>
  <ul
    v-if="series.length > 1"
    class="ep-chart__legend"
  >
    <li
      v-for="item in series"
      :key="item.label"
      class="ep-chart__key"
    >
      <span
        class="ep-chart__swatch"
        :data-mark="mark"
        :data-tone="item.tone"
        :data-pattern="item.pattern"
        aria-hidden="true"
      />{{ item.label }}
    </li>
  </ul>
  <div
    class="ep-chart__plot"
    aria-hidden="true"
  >
    <div class="ep-chart__axis">
      <span
        v-for="tick in scale.ticks"
        :key="tick"
        class="ep-chart__tick"
      >{{ write(tick) }}</span>
    </div>
    <div class="ep-chart__area">
      <div class="ep-chart__rules">
        <span
          v-for="tick in scale.ticks"
          :key="tick"
          class="ep-chart__rule"
        />
      </div>
      <slot />
    </div>
    <div class="ep-chart__labels">
      <span
        v-for="(label, index) in labels"
        :key="index"
        class="ep-chart__label"
      >{{ label }}</span>
    </div>
  </div>
  <div class="ep-chart__table">
    <table>
      <caption>{{ description }}</caption>
      <thead>
        <tr>
          <td />
          <th
            v-for="item in series"
            :key="item.label"
            scope="col"
          >
            {{ item.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(label, index) in labels"
          :key="index"
        >
          <th scope="row">
            {{ label }}
          </th>
          <td
            v-for="item in series"
            :key="item.label"
          >
            {{ cell(item.values[index]) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
