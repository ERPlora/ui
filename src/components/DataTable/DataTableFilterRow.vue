<script setup lang="ts" generic="T extends object">
// The column filters of the table in a row under its toolbar: one control per filtered column, in column order,
// each change handed over at once, and «Clear filters» while some filter filters. The table applies them.
import { IonChip, IonIcon, IonInput, IonLabel, IonSelect, IonSelectOption } from '@ionic/vue';

import DateField from '../DateTimeField/DateField.vue';
import DataTableLookup from './DataTableLookup.vue';
import type { DataTableColumn, DataTableFilters, DataTableLabels } from './types';
import type { FilterControls } from './useFilterControls';
import { usePartChrome } from './usePartChrome';

const props = withDefaults(
  defineProps<{
    /** Every filter, as a column: the columns' own in column order, then `filterFields`. */
    filterColumns: DataTableColumn<T>[];
    /** The filters applied: what each control shows. */
    applied: DataTableFilters;
    /** What the table's filter controls paint besides a value, one state for its row, funnel and panel. */
    controls: FilterControls<T>;
    /** Some filter is applied: «Clear filters» is offered. */
    filtering: boolean;
    labels?: Partial<DataTableLabels>;
    testid?: string;
  }>(),
  { labels: undefined, testid: undefined },
);

const emit = defineEmits<{ filter: [name: string, value: string]; clear: [] }>();

const { ICONS, icon, label, tid } = usePartChrome(props);
const { filterName, errorOf, invalidMark, answerError, choicesOf, lookupLabel, rememberPick, endBox, rangeEnds } = props.controls;

/** Ionic's `ionInput` (text, range) or `ionChange` (select) of one filter control. */
function onFilter(name: string, ev: CustomEvent<{ value?: unknown }>): void {
  handOver(name, ev.detail.value === null || ev.detail.value === undefined ? '' : String(ev.detail.value));
}
/** A filter's new value, as text: what `onFilter` read, or a day picked in a date filter ('' once cleared). */
function handOver(name: string, value: string): void {
  answerError(name);
  emit('filter', name, value);
}
/** A lookup of the filter row: applied at once. */
function onLookup(name: string, value: string, text: string): void {
  rememberPick(name, value, text);
  answerError(name);
  emit('filter', name, value);
}
</script>

<template>
  <div
    class="data-table__filters"
    role="group"
    :aria-label="label('filters')"
    :data-testid="tid('filters')"
  >
    <template
      v-for="column in filterColumns"
      :key="column.key"
    >
      <!-- Unfiltered, «All» ('') is checked and the select reads as its column («Status»). -->
      <ion-select
        v-if="column.filter?.type === 'select' || column.filter?.type === 'boolean'"
        class="data-table__filter"
        :class="invalidMark(filterName(column))"
        interface="popover"
        :aria-label="column.label"
        :placeholder="column.label"
        :value="applied[filterName(column)] ?? ''"
        :selected-text="applied[filterName(column)] ? undefined : column.label"
        :error-text="errorOf(filterName(column))"
        :data-testid="tid(`filter-${filterName(column)}`)"
        @ion-change="onFilter(filterName(column), $event)"
      >
        <ion-select-option value="">
          {{ label('filterAll') }}
        </ion-select-option>
        <ion-select-option
          v-for="option in choicesOf(column)"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </ion-select-option>
      </ion-select>
      <!-- A range is headed by its column, «Total  From  To»: its ends alone say only «From» / «To». The group
           already names it for assistive tech. -->
      <span
        v-else-if="column.filter?.type === 'range' || column.filter?.type === 'daterange'"
        class="data-table__filter-range"
        :class="{ 'data-table__filter-range--date': column.filter?.type === 'daterange' }"
        role="group"
        :aria-label="column.label"
      >
        <span
          class="data-table__filter-range-label"
          aria-hidden="true"
        >{{ column.label }}</span>
        <template v-if="column.filter?.type === 'daterange'">
          <DateField
            v-for="{ name, hint, named } in rangeEnds(column)"
            :key="name"
            class="data-table__filter"
            compact
            :label="named"
            :placeholder="hint"
            :model-value="applied[name] ?? ''"
            :error-text="errorOf(name)"
            :testid="tid(`filter-${name}`)"
            @update:model-value="handOver(name, $event)"
          />
        </template>
        <template v-else>
          <ion-input
            v-for="{ name, hint, named } in rangeEnds(column)"
            :key="name"
            class="data-table__filter"
            :class="invalidMark(name)"
            v-bind="endBox(column)"
            :debounce="250"
            :aria-label="named"
            :placeholder="hint"
            :value="applied[name] ?? ''"
            :error-text="errorOf(name)"
            :data-testid="tid(`filter-${name}`)"
            @ion-input="onFilter(name, $event)"
          />
        </template>
      </span>
      <DateField
        v-else-if="column.filter?.type === 'date'"
        class="data-table__filter"
        compact
        :label="column.label"
        :placeholder="column.label"
        :model-value="applied[filterName(column)] ?? ''"
        :error-text="errorOf(filterName(column))"
        :testid="tid(`filter-${filterName(column)}`)"
        @update:model-value="handOver(filterName(column), $event)"
      />
      <DataTableLookup
        v-else-if="column.filter?.type === 'lookup'"
        :label="column.label"
        :value="applied[filterName(column)] ?? ''"
        :display="lookupLabel(column, applied[filterName(column)])"
        :load="column.filter.load"
        :error-text="errorOf(filterName(column))"
        :labels="labels"
        :testid="tid(`filter-${filterName(column)}`)"
        @change="(value: string, text: string) => onLookup(filterName(column), value, text)"
      />
      <ion-input
        v-else
        class="data-table__filter"
        :class="invalidMark(filterName(column))"
        type="text"
        :clear-input="true"
        :debounce="250"
        :maxlength="column.filter?.type === 'text' ? column.filter.maxlength : undefined"
        :aria-label="column.label"
        :placeholder="column.label"
        :value="applied[filterName(column)] ?? ''"
        :error-text="errorOf(filterName(column))"
        :data-testid="tid(`filter-${filterName(column)}`)"
        @ion-input="onFilter(filterName(column), $event)"
      />
    </template>
    <ion-chip
      v-if="filtering"
      class="data-table__filters-clear"
      role="button"
      tabindex="0"
      :data-testid="tid('filters-clear')"
      @click="emit('clear')"
      @keydown.enter.prevent="emit('clear')"
      @keydown.space.prevent="emit('clear')"
    >
      <ion-label>{{ label('clearFilters') }}</ion-label>
      <ion-icon
        :icon="icon(ICONS.clearFilters)"
        aria-hidden="true"
      />
    </ion-chip>
  </div>
</template>

<style scoped src="./controls.css"></style>

<style scoped>
/* Column filters: a row of boxed controls under the toolbar's main row. */
.data-table__filters { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
.data-table__filter { min-width: 8.5rem; max-width: 13rem; min-height: 44px; font-size: 13px; background: var(--background); color: var(--color); border: 1px solid var(--control-border); border-radius: 10px; --padding-start: 0.7rem; --padding-end: 0.5rem; --padding-top: 0.35rem; --padding-bottom: 0.35rem; }
.data-table__filter-range { display: inline-flex; align-items: center; gap: 0.35rem; }
.data-table__filter-range .data-table__filter { min-width: 5.5rem; max-width: 7rem; }
/* A date range's end is as wide as a date field: in a number box the calendar icon covers the last
   character of «dd/mm/yyyy» (measured in Chromium). */
.data-table__filter-range--date .data-table__filter { min-width: 8.75rem; max-width: 8.75rem; }
/* The column heading a range in the row, on one line: a long one ends in «…», never cut with no sign. */
.data-table__filter-range-label { flex: 0 1 auto; min-width: 0; max-width: 10rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; color: var(--color-muted); }
.data-table__filters-clear { margin: 0; font-size: 13px; }
</style>
