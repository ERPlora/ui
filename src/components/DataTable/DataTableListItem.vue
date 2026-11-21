<script setup lang="ts" generic="T extends object">
import { IonCheckbox } from '@ionic/vue';

import { hasToggle, toggleNote, toggleState } from './columnToggle';
import DataTableIdentity from './DataTableIdentity.vue';
import DataTableRowActions from './DataTableRowActions.vue';
import DataTableToggle from './DataTableToggle.vue';
import { cellText } from './model';
import type { DataTableColumn } from './types';
import { DATA_ROW_DEFAULTS, type DataRowEmits, type DataRowProps, useDataRow } from './useDataRow';

const props = withDefaults(defineProps<DataRowProps<T> & { columns: DataTableColumn<T>[]; template: string }>(), DATA_ROW_DEFAULTS);

const emit = defineEmits<DataRowEmits<T>>();
defineSlots<{ 'row-actions'?: (props: { row: T }) => unknown; [cell: string]: unknown }>();

const { valueOf, isUnfolded, open, onKeydown, onPointerdown, onCellTap } = useDataRow<T>(props, (row) => emit('open', row));
const alignClass = (column: DataTableColumn<T>) => column.align ? `data-table__cell--${column.align}` : undefined;
</script>

<template>
  <div
    :class="['data-table__row', 'data-table__row--data', { 'data-table__row--selected': selectable && selected, 'data-table__row--clickable': clickable }]"
    role="row"
    :data-testid="testid ? `${testid}-row` : undefined"
    :data-id="testid ? rowId : undefined"
    :style="{ gridTemplateColumns: template }"
    :tabindex="clickable ? 0 : undefined"
    @click="open"
    @keydown="onKeydown"
  >
    <span
      v-if="selectable"
      class="data-table__select-cell"
      @click.stop
    >
      <ion-checkbox
        :checked="selected"
        :aria-label="selectLabel"
        @ion-change="emit('select', rowId)"
      />
    </span>
    <div
      v-for="column in columns"
      :key="column.key"
      :class="['data-table__cell', alignClass(column), { 'data-table__cell--pinned': column.pinned === 'end' }]"
      role="cell"
    >
      <DataTableToggle
        v-if="hasToggle(column.toggle, row)"
        v-bind="toggleState(column.toggle, row)"
        @change="emit('toggle', { column: column.key, row, checked: $event })"
      />
      <DataTableIdentity
        v-if="column.identity"
        :title="cellText(column, row)"
        :icon="column.identity.icon(row)"
        :subtitle="column.identity.subtitle?.(row)"
        :testid="column.identity.testid"
      />
      <slot
        v-else-if="column.cell"
        :name="column.cell"
        :row="row"
        :value="valueOf(column)"
        :column="column"
      />
      <span
        v-else
        :class="['data-table__text', { 'data-table__text--unfolded': isUnfolded(column) }]"
        :title="cellText(column, row) || undefined"
        @pointerdown="onPointerdown"
        @click="onCellTap($event, column)"
      >{{ cellText(column, row) }}</span>
      <span
        v-if="toggleNote(column.toggle, row)"
        :class="['data-table__cell-note', `data-table__cell-note--${toggleNote(column.toggle, row)?.tone}`]"
      >{{ toggleNote(column.toggle, row)?.text }}</span>
    </div>
    <div
      v-if="hasActions"
      class="data-table__cell data-table__cell--right data-table__cell--pinned data-table__cell--actions"
      role="cell"
      @click.stop
    >
      <DataTableRowActions
        :row="row"
        :row-id="rowId"
        :items="actions.items"
        :menu="actions.menu"
        :testid="testid"
        :more-label="moreLabel"
        @action="emit('action', $event)"
        @menu="emit('menu', $event, row)"
      >
        <template #row-actions>
          <slot
            name="row-actions"
            :row="row"
          />
        </template>
      </DataTableRowActions>
    </div>
  </div>
</template>

<style scoped>
.data-table__cell { display: flex; align-items: center; min-width: 0; }
/* Its own stacking context: a control with a z-index of its own (Ionic's ion-toggle has 2, the sticky head's) stays
   under the head and the pinned actions. */
.data-table__row--data > .data-table__cell { isolation: isolate; }
.data-table__cell--right { justify-content: flex-end; text-align: right; }
.data-table__cell--center { justify-content: center; text-align: center; }
.data-table__cell--pinned { position: sticky; right: 0; z-index: 1; background: inherit; margin-right: -1rem; padding-right: 1rem; }
.data-table__scroll--overflow .data-table__cell--pinned { box-shadow: -10px 0 10px -10px color-mix(in srgb, var(--color) 45%, transparent); }
.data-table__select-cell { display: flex; align-items: center; justify-content: center; }
.data-table__row--data { min-height: 80px; background: var(--background); border-bottom: 1px solid var(--border-color-soft); padding-top: 0.75rem; padding-bottom: 0.75rem; transition: background-color var(--ep-transition, 150ms ease), color var(--ep-transition, 150ms ease), box-shadow var(--ep-transition, 150ms ease), transform 120ms ease; }
.data-table__row--data:last-child { border-bottom: 0; }
@media (hover: hover) {
  .data-table__row--data:hover { background: linear-gradient(var(--row-hover), var(--row-hover)), var(--background); }
}
.data-table__row--data:active { transform: scale(0.995); }
.data-table__row--data.data-table__row--selected { background: linear-gradient(color-mix(in srgb, var(--primary) 10%, transparent), color-mix(in srgb, var(--primary) 10%, transparent)), var(--background); }
.data-table__row--clickable { cursor: pointer; }
.data-table__row--clickable:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }
.data-table__row--data > .data-table__cell:not(.data-table__cell--actions) { flex-wrap: wrap; gap: 0.25rem; }
.data-table__cell > :deep(span) { min-width: 0; }
.data-table__cell > .data-table__text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.data-table__cell > .data-table__text--unfolded { white-space: normal; overflow-wrap: anywhere; }
/* Under the switch and the cell's own content, from the cell's start edge. */
.data-table__cell-note { flex-basis: 100%; color: var(--ep-text-muted); font-size: 12px; line-height: 1.35; white-space: normal; overflow-wrap: anywhere; }
.data-table__cell-note--danger { color: var(--ep-danger-text, var(--ion-color-danger)); }
@media (prefers-reduced-motion: reduce) {
  .data-table__row--data:hover, .data-table__row--data:active { transform: none; }
}
</style>
