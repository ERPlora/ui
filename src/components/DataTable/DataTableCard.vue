<script setup lang="ts" generic="T extends object">
import { IonCard, IonCardContent, IonCardHeader, IonCheckbox, IonIcon } from '@ionic/vue';
import { ref, watch } from 'vue';

import { ionIconSrc } from '../../shell/icons';
import DataTableRowActions from './DataTableRowActions.vue';
import { cellText } from './model';
import type { DataTableAction, DataTableActionCell, DataTableColumn } from './types';

const props = withDefaults(
  defineProps<{
    row: T;
    rows?: T[];
    rowId: string;
    title: string | number;
    titleColumn?: DataTableColumn<T>;
    icon?: string;
    fields?: DataTableColumn<T>[];
    actions: DataTableActionCell<T>;
    gapLabels?: Map<DataTableAction<T>, string>;
    selectable?: boolean;
    selected?: boolean;
    clickable?: boolean;
    hasActions?: boolean;
    selectLabel?: string;
    moreLabel?: string;
    testid?: string;
  }>(),
  { rows: undefined, titleColumn: undefined, icon: undefined, fields: () => [], gapLabels: undefined, selectable: false, selected: false, clickable: false, hasActions: false, selectLabel: 'Select', moreLabel: 'More actions', testid: undefined },
);

const emit = defineEmits<{
  open: [row: T];
  select: [key: string];
  action: [payload: { action: DataTableAction<T>; row: T }];
  menu: [event: Event, row: T];
}>();
defineSlots<{ card?: (props: { row: T }) => unknown; 'row-actions'?: (props: { row: T }) => unknown; [cell: string]: unknown }>();

const unfolded = ref(new Set<string>());
let pointerType = '';
const iconSrc = ionIconSrc;
const hasHead = () => !!(props.title || props.titleColumn || props.icon || props.selectable);
const valueOf = (column: DataTableColumn<T>) => (props.row as Record<string, unknown>)[column.key];
const cellId = (column: DataTableColumn<T>) => `${props.rowId}␟${column.key}`;

function open(): void {
  if (props.clickable) emit('open', props.row);
}
function onKeydown(event: KeyboardEvent): void {
  if (!props.clickable || !['Enter', ' ', 'Spacebar'].includes(event.key)) return;
  event.preventDefault();
  emit('open', props.row);
}
function onCellTap(event: MouseEvent, column: DataTableColumn<T>): void {
  const span = event.currentTarget as HTMLElement;
  if (props.clickable || pointerType !== 'touch' || span.scrollWidth <= span.clientWidth) return;
  unfolded.value = new Set(unfolded.value).add(cellId(column));
}
watch(() => [props.row, props.rows], () => { unfolded.value = new Set(); });
</script>

<template>
  <ion-card
    :class="['data-table__card', { 'data-table__card--selected': selectable && selected, 'data-table__card--clickable': clickable }]"
    :data-testid="testid ? `${testid}-row` : undefined"
    :data-id="testid ? rowId : undefined"
    :role="clickable ? 'button' : undefined"
    :tabindex="clickable ? 0 : undefined"
    @click="open"
    @keydown="onKeydown"
  >
    <ion-card-header
      v-if="hasHead()"
      class="data-table__card-head"
    >
      <span
        v-if="icon"
        class="data-table__card-icon"
      ><ion-icon
        :icon="iconSrc(icon)"
        aria-hidden="true"
      /></span>
      <span class="data-table__card-title">
        <slot
          v-if="titleColumn?.cell"
          :name="titleColumn.cell"
          :row="row"
          :value="valueOf(titleColumn)"
          :column="titleColumn"
        />
        <template v-else>{{ title }}</template>
      </span>
      <ion-checkbox
        v-if="selectable"
        :checked="selected"
        :aria-label="selectLabel"
        @click.stop
        @ion-change="emit('select', rowId)"
      />
    </ion-card-header>
    <ion-card-content class="data-table__card-body">
      <slot
        v-if="$slots.card"
        name="card"
        :row="row"
      />
      <template v-else>
        <div
          v-for="column in fields"
          :key="column.key"
          class="data-table__field"
          :data-column="column.key"
        >
          <span class="data-table__field-label">{{ column.label }}</span>
          <span class="data-table__field-value">
            <slot
              v-if="column.cell"
              :name="column.cell"
              :row="row"
              :value="valueOf(column)"
              :column="column"
            />
            <span
              v-else
              :class="['data-table__field-text', { 'data-table__field-text--unfolded': unfolded.has(cellId(column)) }]"
              :title="cellText(column, row) || undefined"
              @pointerdown="pointerType = $event.pointerType"
              @click="onCellTap($event, column)"
            >{{ cellText(column, row) }}</span>
          </span>
        </div>
      </template>
    </ion-card-content>
    <div
      v-if="hasActions"
      class="data-table__card-actions"
      @click.stop
    >
      <DataTableRowActions
        :row="row"
        :row-id="rowId"
        :items="actions.items"
        :menu="actions.menu"
        :gap-labels="gapLabels"
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
  </ion-card>
</template>

<style scoped>
:where(.data-table) ion-card { border: 1px solid var(--border-color-soft); border-radius: var(--ep-radius-lg); box-shadow: var(--ep-shadow-xs); }
:where(.data-table) ion-card-header { padding: 16px; }
ion-card.data-table__card { margin: 0; }
.data-table__card--selected { outline: 2px solid var(--primary); outline-offset: -2px; }
.data-table__card--clickable { cursor: pointer; }
.data-table__card--clickable:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }
.data-table__card-head { display: flex; flex-direction: row; flex-wrap: nowrap; align-items: center; gap: 0.5rem; }
.data-table__card-icon { display: inline-grid; place-items: center; flex: none; width: 44px; height: 44px; border-radius: var(--ep-radius-sm); color: var(--ep-primary-text); background: var(--ep-primary-tint); font-size: 22px; }
.data-table__card-title { flex: 1; min-width: 0; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: anywhere; font-size: 17px; line-height: 1.3; font-weight: 650; }
.data-table__card-body { display: flex; flex-direction: column; gap: 0.4rem; }
.data-table__field { display: flex; justify-content: space-between; gap: 0.5rem; font-size: 13px; }
.data-table__field-label { color: var(--color-muted); }
.data-table__field-value { font-weight: 500; text-align: right; color: var(--color); min-width: 0; }
.data-table__field-text { display: block; overflow: hidden; text-overflow: ellipsis; overflow-wrap: normal; }
.data-table__field-text--unfolded { overflow-wrap: anywhere; }
.data-table__card-actions { display: flex; justify-content: flex-end; gap: 0.25rem; padding: 0 0.5rem 0.5rem; }
.data-table__card-actions .data-table__actions { flex-wrap: wrap; }
</style>
