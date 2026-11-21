<script setup lang="ts">
// What the bar and the line chart share: the frame with its states, the legend (two series or more), the value axis
// with its rules, the labels along the bottom and, for a screen reader, the table of the same values. Each chart draws
// its marks in the slot, over the rules, from the series as drawn and the round scale it is given. The drawing is
// hidden from a screen reader, which reads the table instead.
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { formatQuantity } from '../format';
import { useAxisLabels } from './axisLabels';
import ChartFrame from './ChartFrame.vue';
import { type ChartMark, type DrawnSeries, drawnSeries, hasValues } from './model';
import { niceScale, type Scale } from './scale';
import type { ChartProps } from './types';

const props = withDefaults(defineProps<ChartProps & { mark: ChartMark }>(), {
  format: undefined,
  loading: false,
  error: false,
  emptyLabel: undefined,
  testid: undefined,
});

const emit = defineEmits<{ retry: [] }>();

defineSlots<{ default(scope: { series: DrawnSeries[]; scale: Scale }): unknown }>();

const { locale } = useI18n();

const series = computed(() => drawnSeries(props.series, props.mark));
const scale = computed(() => niceScale(series.value.flatMap((item) => item.values)));
const write = computed(() => props.format ?? ((value: number) => formatQuantity(value, locale.value)));
const labelBox = ref<HTMLElement>();
const axis = useAxisLabels(labelBox, () => props.labels);
const cell = (value: number | null | undefined): string => (value === null || value === undefined ? '—' : write.value(value));
</script>

<template>
  <ChartFrame
    :kind="mark"
    :drawable="hasValues(labels, props.series)"
    :description="description"
    :loading="loading"
    :error="error"
    :empty-label="emptyLabel"
    :testid="testid"
    @retry="emit('retry')"
  >
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
        <slot
          :series="series"
          :scale="scale"
        />
      </div>
      <div
        ref="labelBox"
        class="ep-chart__labels"
      >
        <span
          v-for="(label, index) in labels"
          :key="index"
          class="ep-chart__label"
          :data-skipped="axis.skipped(index) || undefined"
          :style="{ left: axis.left(index) }"
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
  </ChartFrame>
</template>
