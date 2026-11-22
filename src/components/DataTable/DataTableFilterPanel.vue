<script setup lang="ts" generic="T extends object">
// The filters panel of the table (`filterable`, or its cards): one control per filtered column on a draft of
// the filters applied; «Clear» lifts them all now, «Apply» hands the draft over. The table opens it, places it
// beside the list or as a sheet, and applies what it hands over.
import { IonButton, IonIcon, IonInput, IonSelect, IonSelectOption } from '@ionic/vue';
import { computed, ref, useId, watch } from 'vue';

import DateField from '../DateTimeField/DateField.vue';
import DataTableLookup from './DataTableLookup.vue';
import { activeFilters, declaredFilters } from './model';
import type { DataTableColumn, DataTableFilters, DataTableLabels } from './types';
import type { FilterControls } from './useFilterControls';
import { trapTab } from './useFilterSheet';
import { usePartChrome } from './usePartChrome';

const props = withDefaults(
  defineProps<{
    /** Every filter, as a column: the columns' own in column order, then `filterFields`. */
    filterColumns: DataTableColumn<T>[];
    /** The filters applied: the draft starts from them, and shows them again when they change. */
    applied: DataTableFilters;
    /** What the table's filter controls paint besides a value, one state for its row, funnel and panel. */
    controls: FilterControls<T>;
    /** Some filter is applied. */
    filtering: boolean;
    /** Below 834 px the panel is a modal sheet over the list. */
    sheet: boolean;
    labels?: Partial<DataTableLabels>;
    testid?: string;
  }>(),
  { labels: undefined, testid: undefined },
);

const emit = defineEmits<{ apply: [filters: DataTableFilters]; clear: []; close: [] }>();

const { ICONS, icon, label, tid } = usePartChrome(props);
const { filterName, errorOf, invalidMark, answerError, choicesOf, lookupLabel, rememberPick, endBox, rangeEnds } = props.controls;

/** What the panel shows and edits; applied only by «Apply». */
const filterDraft = ref<DataTableFilters>(declaredFilters(props.filterColumns, props.applied));
const filterTitleId = useId();
/** «Clear» has something to lift: a filter applied, or one written in the draft. */
const canClearPanel = computed(() => props.filtering || Object.keys(activeFilters(filterDraft.value)).length > 0);
/** Below 834 px the panel is a modal sheet over the list: Tab stays inside it. */
function onFilterPanelTab(ev: KeyboardEvent): void {
  if (props.sheet) trapTab(ev.currentTarget as HTMLElement, ev);
}

function clearFilterPanel(): void {
  filterDraft.value = {};
  emit('clear');
}
/** One control of the panel: `ionInput` (text, range) or `ionChange` (select) into the draft. */
function onDraftFilter(name: string, ev: CustomEvent<{ value?: unknown }>): void {
  draft(name, ev.detail.value === null || ev.detail.value === undefined ? '' : String(ev.detail.value));
}
/** A filter's new value into the draft, as text: what `onDraftFilter` read, or a day picked ('' once cleared). */
function draft(name: string, value: string): void {
  answerError(name);
  filterDraft.value = { ...filterDraft.value, [name]: value };
}
/** A lookup of the panel: into the draft, with the label it was picked with. */
function onDraftLookup(name: string, value: string, text: string): void {
  rememberPick(name, value, text);
  answerError(name);
  filterDraft.value = { ...filterDraft.value, [name]: value };
}
/** Escape closes the panel, unless a control inside already used it (closing its own dropdown). */
function onFilterPanelEscape(ev: KeyboardEvent): void {
  if (ev.defaultPrevented) return;
  ev.preventDefault();
  emit('close');
}
// The applied filters changed while the panel is open (a «Clear», the parent): it shows them.
watch(
  () => props.applied,
  (now) => {
    filterDraft.value = declaredFilters(props.filterColumns, now);
  },
);
</script>

<template>
  <aside
    class="data-table__drawer"
    role="dialog"
    tabindex="-1"
    :aria-labelledby="filterTitleId"
    :aria-modal="sheet ? 'true' : undefined"
    :data-testid="tid('filters-panel')"
    @keydown.esc="onFilterPanelEscape"
    @keydown.tab="onFilterPanelTab"
  >
    <header class="data-table__drawer-head">
      <strong :id="filterTitleId">{{ label('filters') }}</strong>
      <ion-button
        fill="clear"
        size="small"
        :aria-label="label('close')"
        :data-testid="tid('filters-close')"
        @click="emit('close')"
      >
        <ion-icon
          slot="icon-only"
          :icon="icon(ICONS.clear)"
          aria-hidden="true"
        />
      </ion-button>
    </header>
    <div class="data-table__drawer-body">
      <template
        v-for="column in filterColumns"
        :key="column.key"
      >
        <ion-select
          v-if="column.filter?.type === 'select' || column.filter?.type === 'boolean'"
          :class="invalidMark(filterName(column))"
          :label="column.label"
          label-placement="stacked"
          fill="outline"
          mode="md"
          interface="popover"
          :value="filterDraft[filterName(column)] ?? ''"
          :error-text="errorOf(filterName(column))"
          :data-testid="tid(`filter-${filterName(column)}`)"
          @ion-change="onDraftFilter(filterName(column), $event)"
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
        <div
          v-else-if="column.filter?.type === 'range' || column.filter?.type === 'daterange'"
          class="data-table__drawer-field"
          role="group"
          :aria-label="column.label"
        >
          <span
            class="data-table__drawer-label"
            aria-hidden="true"
          >{{ column.label }}</span>
          <div
            v-if="column.filter?.type === 'daterange'"
            class="data-table__drawer-range"
          >
            <DateField
              v-for="{ name, hint } in rangeEnds(column)"
              :key="name"
              :label="hint"
              :model-value="filterDraft[name] ?? ''"
              :error-text="errorOf(name)"
              :testid="tid(`filter-${name}`)"
              @update:model-value="draft(name, $event)"
            />
          </div>
          <div
            v-else
            class="data-table__drawer-range"
          >
            <ion-input
              v-for="{ name, hint, named } in rangeEnds(column)"
              :key="name"
              :class="invalidMark(name)"
              v-bind="endBox(column)"
              fill="outline"
              mode="md"
              :aria-label="named"
              :placeholder="hint"
              :value="filterDraft[name] ?? ''"
              :error-text="errorOf(name)"
              :data-testid="tid(`filter-${name}`)"
              @ion-input="onDraftFilter(name, $event)"
            />
          </div>
        </div>
        <DateField
          v-else-if="column.filter?.type === 'date'"
          :label="column.label"
          :model-value="filterDraft[filterName(column)] ?? ''"
          :error-text="errorOf(filterName(column))"
          :testid="tid(`filter-${filterName(column)}`)"
          @update:model-value="draft(filterName(column), $event)"
        />
        <DataTableLookup
          v-else-if="column.filter?.type === 'lookup'"
          :label="column.label"
          :value="filterDraft[filterName(column)] ?? ''"
          :display="lookupLabel(column, filterDraft[filterName(column)])"
          :load="column.filter.load"
          :error-text="errorOf(filterName(column))"
          :labels="labels"
          :testid="tid(`filter-${filterName(column)}`)"
          @change="(value: string, text: string) => onDraftLookup(filterName(column), value, text)"
        />
        <ion-input
          v-else
          :class="invalidMark(filterName(column))"
          type="text"
          :label="column.label"
          label-placement="stacked"
          fill="outline"
          mode="md"
          :clear-input="true"
          :maxlength="column.filter?.type === 'text' ? column.filter.maxlength : undefined"
          :value="filterDraft[filterName(column)] ?? ''"
          :error-text="errorOf(filterName(column))"
          :data-testid="tid(`filter-${filterName(column)}`)"
          @ion-input="onDraftFilter(filterName(column), $event)"
        />
      </template>
    </div>
    <footer class="data-table__drawer-foot">
      <ion-button
        class="data-table__drawer-clear"
        fill="clear"
        size="small"
        :disabled="!canClearPanel"
        :data-testid="tid('filters-clear')"
        @click="clearFilterPanel"
      >
        {{ label('clear') }}
      </ion-button>
      <ion-button
        class="data-table__primary-button"
        size="small"
        :data-testid="tid('filters-apply')"
        @click="emit('apply', filterDraft)"
      >
        {{ label('apply') }}
      </ion-button>
    </footer>
  </aside>
</template>

<style scoped src="./controls.css"></style>

<style scoped>
/* The panel, INSIDE the table. Base: an overlay on the right edge (what a browser without media
   queries sees). It PUSHES on a desk and is a WHOLE sheet on a phone, never half covering. */
.data-table__drawer { position: absolute; top: 0; right: 0; height: 100%; width: 340px; max-width: 88%;
  background: var(--background); border-left: 1px solid var(--border-color);
  display: flex; flex-direction: column; z-index: 20;
  animation: tk-slide-in 0.18s ease; }
@keyframes tk-slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
/* < 834px: a sheet over the content area, with its header (title + Close): the app's header and
   tab bar stay visible and in front (the insets come from `useFilterSheet`; Shopify, Fresha). */
@media (max-width: 833.98px) {
  .data-table__drawer { position: fixed; inset: 0; top: var(--data-table-sheet-top, 0px); bottom: var(--data-table-sheet-bottom, 0px); width: 100%; max-width: none; height: auto; border-left: 0; z-index: 1000; }
  /* Reaching the screen edge (no tab bar below), its footer keeps the safe area. */
  .data-table__drawer-foot { padding-bottom: calc(0.6rem + var(--data-table-sheet-safe-bottom)); }
}
.data-table__drawer-head { flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between;
  padding: 0.6rem 0.5rem 0.6rem 1rem; border-bottom: 1px solid var(--border-color); font-size: 1rem; }
.data-table__drawer-body { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 1rem; display: flex; flex-direction: column; gap: 0.85rem; }
/* A range: its column's name over its two ends. */
.data-table__drawer-field { display: flex; flex-direction: column; gap: 0.45rem; }
.data-table__drawer-label { font-size: 13px; font-weight: 500; color: var(--color); }
.data-table__drawer-range { display: flex; gap: 0.5rem; }
/* Both ends share the panel width: a flex item never shrinks below its content, and two date fields
   would reach 21px past the 360px panel, «To» without its border. */
.data-table__drawer-range > ion-input { flex: 1 1 0; min-width: 0; }
/* Its footer: «Clear» at the start, «Apply» at the end. */
.data-table__drawer-foot { flex: 0 0 auto; display: flex; align-items: center; justify-content: flex-end; gap: 0.4rem; padding: 0.6rem 0.85rem; border-top: 1px solid var(--border-color); }
.data-table__drawer-foot .data-table__drawer-clear { margin-right: auto; }
</style>
