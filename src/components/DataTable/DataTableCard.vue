<script setup lang="ts" generic="T extends object">
import { IonCard, IonCardContent, IonCardHeader, IonCheckbox, IonIcon } from '@ionic/vue';
import { computed, ref, watch } from 'vue';

import HubIcon from '../../shell/HubIcon.vue';
import { ionIconSrc } from '../../shell/icons';
import StatusPill from '../StatusPill/StatusPill.vue';
import DataTableIdentity from './DataTableIdentity.vue';
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
    selectable?: boolean;
    selected?: boolean;
    clickable?: boolean;
    hasActions?: boolean;
    selectLabel?: string;
    moreLabel?: string;
    testid?: string;
  }>(),
  { rows: undefined, titleColumn: undefined, icon: undefined, fields: () => [], selectable: false, selected: false, clickable: false, hasActions: false, selectLabel: 'Select', moreLabel: 'More actions', testid: undefined },
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
const statusField = computed(() => props.fields.find((column) => ['state', 'status'].includes(column.key)));
const descriptionField = computed(() => props.fields.find((column) => ['summary', 'description'].includes(column.key)));
const metaFields = computed(() => props.fields.filter((column) => column !== statusField.value && column !== descriptionField.value && hasValue(column)));
/** A slot paints what the table cannot read, so only a plain field is left out when it is empty. */
function hasValue(column: DataTableColumn<T>): boolean {
  if (column.cell) return true;
  const text = cellText(column, props.row).trim();
  return text !== '' && text !== '—';
}

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
        v-if="icon && !titleColumn?.identity"
        class="data-table__card-icon"
      ><ion-icon
        :icon="iconSrc(icon)"
        aria-hidden="true"
      /></span>
      <span class="data-table__card-title">
        <DataTableIdentity
          v-if="titleColumn?.identity"
          :title="title"
          :icon="titleColumn.identity.icon(row)"
          :subtitle="titleColumn.identity.subtitle?.(row)"
          :testid="titleColumn.identity.testid"
        />
        <slot
          v-else-if="titleColumn?.cell"
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
          v-if="statusField"
          class="data-table__card-status"
          :data-column="statusField.key"
        >
          <slot
            v-if="statusField.cell"
            :name="statusField.cell"
            :row="row"
            :value="valueOf(statusField)"
            :column="statusField"
          />
          <StatusPill
            v-else
            :label="cellText(statusField, row)"
          />
        </div>
        <div
          v-if="descriptionField"
          class="data-table__card-description"
          :data-column="descriptionField.key"
        >
          <slot
            v-if="descriptionField.cell"
            :name="descriptionField.cell"
            :row="row"
            :value="valueOf(descriptionField)"
            :column="descriptionField"
          />
          <span v-else>{{ cellText(descriptionField, row) }}</span>
        </div>
        <div
          v-for="column in metaFields"
          :key="column.key"
          class="data-table__card-meta"
          :data-column="column.key"
        >
          <HubIcon
            class="data-table__card-meta-icon"
            :name="column.cardIcon ?? 'ion:information-circle-outline'"
          />
          <span class="data-table__card-meta-label">{{ column.label }}</span>
          <span class="data-table__card-meta-value">
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
      v-if="hasActions && (actions.items.length > 0 || actions.menu.length > 0 || !!$slots['row-actions'])"
      class="data-table__card-actions"
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
.data-table__card-body { display: flex; flex-direction: column; gap: 0.75rem; }
.data-table__card-status { display: flex; flex-wrap: wrap; gap: 0.375rem; min-width: 0; }
.data-table__card-description { margin: 0; color: var(--ep-text-muted); font-size: 14px; line-height: 1.5; }
.data-table__card-meta { display: flex; align-items: center; gap: 0.5rem; min-width: 0; color: var(--ep-text-muted); font-size: 12px; }
.data-table__card-meta-icon { flex: none; width: 16px; height: 16px; color: var(--ep-primary-text); font-size: 16px; }
.data-table__card-meta-label { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
.data-table__card-meta-value { min-width: 0; color: var(--color); font-weight: 500; }
.data-table__field-text { display: block; overflow: hidden; text-overflow: ellipsis; overflow-wrap: normal; }
.data-table__field-text--unfolded { overflow-wrap: anywhere; }
.data-table__card-actions { display: flex; justify-content: flex-end; gap: 0.25rem; padding: 0.75rem; border-top: 1px solid var(--border-color-soft); }
.data-table__card-actions .data-table__actions { width: 100%; flex-wrap: nowrap; }
.data-table__card-actions :deep(.data-table__action--main) { flex: 1 1 auto; }
</style>
