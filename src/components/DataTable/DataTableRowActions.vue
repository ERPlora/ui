<script setup lang="ts" generic="T extends object">
import { IonButton, IonIcon, IonSpinner } from '@ionic/vue';

import { ionIconSrc } from '../../shell/icons';
import { actionLabel, DATA_TABLE_ICONS, iconWithLabel, toneStyle } from './model';
import type { DataTableAction, DataTableActionCell } from './types';

const props = withDefaults(
  defineProps<{
    row: T;
    rowId: string;
    items: DataTableActionCell<T>['items'];
    menu: DataTableAction<T>[];
    gapLabels?: Map<DataTableAction<T>, string>;
    testid?: string;
    moreLabel: string;
  }>(),
  { gapLabels: undefined, testid: undefined },
);

const emit = defineEmits<{
  action: [payload: { action: DataTableAction<T>; row: T }];
  menu: [event: Event, row: T];
}>();
defineSlots<{ 'row-actions'?: (props: { row: T }) => unknown }>();

const icon = ionIconSrc;
const busy = (action: DataTableAction<T>) => action.loading?.(props.row) === true;
const disabled = (action: DataTableAction<T>) => busy(action) || action.disabled?.(props.row) === true;
const hook = (id: string) => (props.testid ? `${props.testid}-row-${props.rowId}-${id}` : undefined);

function run(action: DataTableAction<T>): void {
  if (!disabled(action)) emit('action', { action, row: props.row });
}
</script>

<template>
  <div class="data-table__actions">
    <template
      v-for="{ action, gap, primary } in items"
      :key="action.id"
    >
      <ion-button
        :class="{
          'data-table__action-gap': gap,
          'data-table__action--labelled': iconWithLabel(action) || primary,
          'data-table__action--primary': (primary || action.pinned) && !gap,
        }"
        size="small"
        :fill="!gap && (primary || action.pinned) ? 'outline' : 'clear'"
        :style="toneStyle(action.color ?? 'medium', 'clear')"
        :data-testid="gap ? undefined : hook(action.id)"
        :data-slot-for="gap ? action.id : undefined"
        :disabled="gap ? undefined : disabled(action)"
        :aria-disabled="!gap && disabled(action) ? 'true' : undefined"
        :aria-label="gap ? undefined : actionLabel(action, row)"
        :title="gap ? undefined : actionLabel(action, row)"
        :aria-hidden="gap ? 'true' : undefined"
        :inert="gap"
        @click="!gap && run(action)"
      >
        <ion-spinner
          v-if="!gap && busy(action) && (iconWithLabel(action) || primary)"
          slot="start"
          name="dots"
        />
        <ion-spinner
          v-else-if="!gap && busy(action)"
          slot="icon-only"
          name="dots"
        />
        <ion-icon
          v-else-if="action.icon && (iconWithLabel(action) || primary)"
          slot="start"
          :icon="icon(action.icon)"
          aria-hidden="true"
        />
        <ion-icon
          v-else-if="action.icon"
          slot="icon-only"
          :icon="icon(action.icon)"
          aria-hidden="true"
        />
        <template v-if="gap ? !action.icon || iconWithLabel(action) : iconWithLabel(action) || primary || (!action.icon && !busy(action))">
          {{ gap ? gapLabels?.get(action) : actionLabel(action, row) }}
        </template>
      </ion-button>
    </template>
    <slot
      name="row-actions"
      :row="row"
    />
    <ion-button
      v-if="menu.length"
      size="small"
      fill="clear"
      :style="toneStyle('medium', 'clear')"
      :data-testid="hook('menu')"
      :aria-label="moreLabel"
      :title="moreLabel"
      aria-haspopup="menu"
      @click="emit('menu', $event, row)"
    >
      <ion-icon
        slot="icon-only"
        :icon="icon(DATA_TABLE_ICONS.more)"
        aria-hidden="true"
      />
    </ion-button>
  </div>
</template>

<style scoped>
.data-table__actions { display: flex; gap: 0.25rem; justify-content: flex-end; }
.data-table__actions ion-button { flex: 0 0 auto; min-width: 44px; min-height: 44px; margin: 0; }
.data-table__actions .data-table__action--labelled { font-size: 13px; font-weight: 500; --padding-start: 0.5rem; --padding-end: 0.6rem; }
.data-table__action--labelled > [slot="start"] { margin-inline: 0 0.3rem; }
.data-table__actions .data-table__action--primary { font-weight: 600; }
.data-table__actions .data-table__action-gap { visibility: hidden; }
.data-table__actions ion-spinner { width: 18px; height: 18px; }
</style>
