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
    testid?: string;
    moreLabel: string;
  }>(),
  { testid: undefined },
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
/** Its text is painted: the card's main button, `showLabel`, or no icon to stand for it. */
const labelled = (action: DataTableAction<T>, primary?: boolean) => !!primary || iconWithLabel(action) || !action.icon;

function run(action: DataTableAction<T>): void {
  if (!disabled(action)) emit('action', { action, row: props.row });
}
</script>

<template>
  <div class="data-table__actions">
    <ion-button
      v-for="{ action, primary } in items"
      :key="action.id"
      :class="{ 'data-table__action--labelled': labelled(action, primary), 'data-table__action--main': primary }"
      size="small"
      :fill="primary || action.pinned ? 'outline' : 'clear'"
      :style="toneStyle(action.color ?? 'medium', 'clear')"
      :data-testid="hook(action.id)"
      :disabled="disabled(action)"
      :aria-disabled="disabled(action) ? 'true' : undefined"
      :aria-label="actionLabel(action, row)"
      :title="actionLabel(action, row)"
      @click="run(action)"
    >
      <ion-spinner
        v-if="busy(action) && labelled(action, primary)"
        slot="start"
        name="dots"
      />
      <ion-spinner
        v-else-if="busy(action)"
        slot="icon-only"
        name="dots"
      />
      <ion-icon
        v-else-if="action.icon && labelled(action, primary)"
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
      <template v-if="labelled(action, primary)">
        {{ actionLabel(action, row) }}
      </template>
    </ion-button>
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
.data-table__actions .data-table__action--main { font-weight: 600; }
.data-table__actions ion-spinner { width: 18px; height: 18px; }
</style>
