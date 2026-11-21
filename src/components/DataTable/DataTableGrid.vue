<script setup lang="ts" generic="T extends object">
// The list view of the table, in CSS grid (not <table>): width per column and a sticky header with «select all»,
// a sortable head per column and the actions head, then one row per record on screen. The table keeps what is
// sorted, selected and folded; this paints it and hands over each pick.
import { IonCheckbox, IonIcon } from '@ionic/vue';
import { computed } from 'vue';

import DataTableListItem from './DataTableListItem.vue';
import type { DataTableActionCell, DataTableColumn, DataTableLabels } from './types';
import type { ColumnSort } from './useColumnSort';
import type { DataRowEmits } from './useDataRow';
import { usePartChrome } from './usePartChrome';

const props = withDefaults(
  defineProps<{
    /** The rows on screen. */
    visible: readonly T[];
    /** Every record the table holds. */
    rows: T[];
    /** The list's columns: the visible ones the box has not taken away. */
    columns: DataTableColumn<T>[];
    /** The grid tracks of the head and of every row. */
    template: string;
    /** The list is wider than its box: the pinned column casts its shadow. */
    xOverflow: boolean;
    /** What the table's sort says of each column. */
    sorting: Pick<ColumnSort<T>, 'isSortable' | 'isSorted' | 'caretIcon' | 'ariaSort'>;
    selectable: boolean;
    /** Every row on screen is selected. */
    allSelected: boolean;
    /** The keys of the selected rows. */
    selection: ReadonlySet<string>;
    keyOf: (row: T) => string;
    rowId: (row: T, index: number) => string;
    /** The buttons and the «⋮» of a row. */
    listActions: (row: T) => DataTableActionCell<T>;
    hasActions: boolean;
    /** Every row action is folded into «⋮». */
    rowActionsCollapsed: boolean;
    /** The «Actions» head fits its column. */
    actionsLabelFits: boolean;
    rowClickable: boolean;
    labels?: Partial<DataTableLabels>;
    testid?: string;
  }>(),
  { labels: undefined, testid: undefined },
);

const emit = defineEmits<DataRowEmits<T> & { selectAll: []; sort: [column: DataTableColumn<T>] }>();
defineSlots<{ 'row-actions'?: (props: { row: T }) => unknown; [cell: string]: unknown }>();

const { icon, label } = usePartChrome(props);
const { isSortable, isSorted, caretIcon, ariaSort } = props.sorting;
/** The columns whose cell is the page's own slot, handed down to each row. */
const cellColumns = computed(() => props.columns.filter((column) => column.cell));
const alignClass = (column: DataTableColumn<T>): string | undefined =>
  column.align === 'right' ? 'data-table__cell--right' : column.align === 'center' ? 'data-table__cell--center' : undefined;
</script>

<template>
  <div :class="['data-table__scroll', { 'data-table__scroll--overflow': xOverflow }]">
    <div
      class="data-table__grid"
      role="table"
    >
      <div
        class="data-table__row data-table__row--head"
        role="row"
        :style="{ gridTemplateColumns: template }"
      >
        <span
          v-if="selectable"
          class="data-table__select-cell"
        >
          <ion-checkbox
            :checked="allSelected"
            :aria-label="label('selectAll')"
            @ion-change="emit('selectAll')"
          />
        </span>
        <div
          v-for="column in columns"
          :key="column.key"
          :class="[
            'data-table__cell data-table__cell--header',
            alignClass(column),
            {
              'data-table__cell--sortable': isSortable(column),
              'data-table__cell--pinned': column.pinned === 'end',
            },
          ]"
          role="columnheader"
          :aria-sort="ariaSort(column)"
          @click="emit('sort', column)"
        >
          <span :title="column.label || undefined">{{ column.label }}</span>
          <span
            v-if="isSortable(column)"
            :class="['data-table__caret', { 'data-table__caret--active': isSorted(column) }]"
          ><ion-icon
            :icon="icon(caretIcon(column))"
            aria-hidden="true"
          /></span>
        </div>
        <div
          v-if="hasActions"
          class="data-table__cell data-table__cell--header data-table__cell--right data-table__cell--pinned data-table__cell--actions"
          role="columnheader"
        >
          <!-- Named for assistive tech, not painted, when it would not fit. -->
          <span :class="{ 'data-table__sr-only': rowActionsCollapsed || !actionsLabelFits }">{{ label('actions') }}</span>
        </div>
      </div>

      <DataTableListItem
        v-for="(row, index) in visible"
        :key="rowId(row, index)"
        :row="row"
        :rows="rows"
        :row-id="rowId(row, index)"
        :columns="columns"
        :template="template"
        :actions="listActions(row)"
        :selectable="selectable"
        :selected="selection.has(keyOf(row))"
        :clickable="rowClickable"
        :has-actions="hasActions"
        :select-label="label('selectRow')"
        :more-label="label('moreActions')"
        :testid="testid"
        @open="emit('open', $event)"
        @select="emit('select', $event)"
        @action="emit('action', $event)"
        @menu="(event, menuRow) => emit('menu', event, menuRow)"
        @toggle="emit('toggle', $event)"
      >
        <template #row-actions="{ row: actionRow }">
          <slot
            name="row-actions"
            :row="actionRow"
          />
        </template>
        <template
          v-for="column in cellColumns"
          :key="column.key"
          #[column.cell]="cellProps"
        >
          <slot
            :name="column.cell"
            v-bind="cellProps"
          />
        </template>
      </DataTableListItem>
    </div>
  </div>
</template>

<style scoped src="./controls.css"></style>

<style scoped>
/* A permanent horizontal scrollbar when it overflows (the macOS overlay hides itself). */
.data-table__scroll { overflow-x: auto; }
.data-table__scroll::-webkit-scrollbar { height: 10px; }
.data-table__scroll::-webkit-scrollbar-track { background: transparent; }
.data-table__scroll::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--color) 25%, transparent); border-radius: 6px; }
.data-table__scroll::-webkit-scrollbar-thumb:hover { background: color-mix(in srgb, var(--color) 40%, transparent); }
/* The grid floor is the SUM of the column minimums (min-content), not its maximum. */
.data-table__grid { min-width: min-content; font-size: 14px; }
.data-table__row { display: grid; align-items: center; gap: 0.5rem; padding: 0 1rem; }
.data-table__row--head { position: sticky; top: 0; z-index: 2; border-bottom: 1px solid var(--border-color); background: var(--header-background); padding-top: 0.55rem; padding-bottom: 0.55rem; }
.data-table__cell { display: flex; align-items: center; min-width: 0; }
.data-table__cell--header > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.data-table__cell--right { justify-content: flex-end; text-align: right; }
.data-table__cell--center { justify-content: center; text-align: center; }
/* PINNED column (row actions, `pinned: 'end'`): stuck to the right edge, on the row background. */
.data-table__cell--pinned { position: sticky; right: 0; z-index: 1; background: inherit; margin-right: -1rem; padding-right: 1rem; }
/* The shadow only when something is really hidden to the left. */
.data-table__scroll--overflow .data-table__cell--pinned { box-shadow: -10px 0 10px -10px color-mix(in srgb, var(--color) 45%, transparent); }
/* The pinned header is OPAQUE: the tint laid over the table background. */
.data-table__row--head .data-table__cell--pinned { z-index: 3; background: linear-gradient(var(--header-background), var(--header-background)), var(--background); }
.data-table__cell--header { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted); }
.data-table__cell--sortable { cursor: pointer; user-select: none; white-space: nowrap; transition: background-color var(--ep-transition, 150ms ease), color var(--ep-transition, 150ms ease), box-shadow var(--ep-transition, 150ms ease), transform 120ms ease; }
@media (hover: hover) {
  .data-table__cell--sortable:hover { color: var(--color); }
}
/* Sort caret (3 states): neutral dimmed / active in primary. */
.data-table__caret { display: inline-flex; align-items: center; margin-left: 0.25rem; flex: 0 0 auto; font-size: 13px; opacity: 0.3; }
.data-table__caret--active { opacity: 1; color: var(--primary); }
.data-table__select-cell { display: flex; align-items: center; justify-content: center; }
@media (prefers-reduced-motion: reduce) {
  .data-table__cell--sortable:hover, .data-table__cell--sortable:active,
  .data-table__row--data:hover, .data-table__row--data:active { transform: none; }
}

/* Named for assistive tech, not painted. */
.data-table__sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
</style>
