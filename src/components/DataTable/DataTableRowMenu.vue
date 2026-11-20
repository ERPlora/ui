<script setup lang="ts" generic="T extends object">
import { IonContent, IonIcon, IonItem, IonLabel, IonList, IonPopover } from '@ionic/vue';

import { ionIconSrc } from '../../shell/icons';
import { actionLabel, toneStyle } from './model';
import type { DataTableAction } from './types';

const props = withDefaults(
  defineProps<{
    open: boolean;
    /** The tap that opened it: Ionic places the menu beside it. */
    event?: Event;
    row?: T;
    actions: DataTableAction<T>[];
    /** `data-testid` prefix of its items (`<hook>-<action id>`), the same as the buttons'. */
    hook?: string;
  }>(),
  { event: undefined, row: undefined, hook: undefined },
);

const emit = defineEmits<{
  pick: [action: DataTableAction<T>];
  dismiss: [];
}>();

const icon = ionIconSrc;
const disabled = (action: DataTableAction<T>, row: T): boolean => action.loading?.(row) === true || action.disabled?.(row) === true;

function pick(action: DataTableAction<T>): void {
  if (props.row && !disabled(action, props.row)) emit('pick', action);
}
</script>

<template>
  <!-- Ionic presents it out of the table, beside the «⋮» that opened it. -->
  <ion-popover
    v-if="row"
    class="data-table__row-menu"
    :is-open="open"
    :event="event"
    :dismiss-on-select="true"
    @did-dismiss="emit('dismiss')"
  >
    <ion-content>
      <ion-list lines="none">
        <ion-item
          v-for="action in actions"
          :key="action.id"
          :button="true"
          :detail="false"
          :data-testid="hook ? `${hook}-${action.id}` : undefined"
          :disabled="disabled(action, row)"
          :aria-disabled="disabled(action, row) ? 'true' : undefined"
          :aria-label="action.ariaLabel?.(row)"
          @click="pick(action)"
        >
          <ion-icon
            v-if="action.icon"
            slot="start"
            :icon="icon(action.icon)"
            :style="toneStyle(action.color, 'text')"
            aria-hidden="true"
          />
          <ion-label :style="toneStyle(action.color, 'text')">
            {{ actionLabel(action, row) }}
          </ion-label>
        </ion-item>
      </ion-list>
    </ion-content>
  </ion-popover>
</template>
