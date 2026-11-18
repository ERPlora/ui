<script setup lang="ts">
import { IonChip, IonItem, IonLabel } from '@ionic/vue';

import HubIcon from '../HubIcon.vue';
import type { ActionNotice } from './types';

defineProps<{
  notice: ActionNotice;
  resolved?: boolean;
}>();
const emit = defineEmits<{ select: [id: string] }>();
</script>

<template>
  <ion-item
    class="action-row"
    :data-severity="notice.severity"
    :data-resolved="resolved ? 'true' : undefined"
    :button="true"
    :detail="!resolved"
    data-testid="action-row"
    @click="emit('select', notice.id)"
  >
    <HubIcon
      slot="start"
      class="action-row__icon"
      :name="notice.icon"
    />
    <ion-label>
      <strong>{{ notice.label }}</strong>
      <ion-chip v-if="notice.chip">
        {{ notice.chip }}
      </ion-chip>
    </ion-label>
    <HubIcon
      v-if="resolved"
      slot="end"
      class="action-row__resolved"
      name="ion:checkmark-circle"
    />
  </ion-item>
</template>

<style scoped>
.action-row {
  --tone: var(--ep-primary-text);
  --background: transparent;
  --min-height: 58px;
  --padding-start: 10px;
  --inner-padding-end: 6px;
  --border-radius: 16px;
  font-size: 14px;
}
.action-row[data-severity='danger'] { --tone: var(--ep-danger-text); }
.action-row[data-severity='warning'] { --tone: var(--ep-warning-text); }
.action-row::part(native) { border-radius: 16px; transition: transform 150ms var(--ep-ease-out); }
.action-row:active::part(native) { transform: scale(0.97); }
.action-row__icon { margin-inline-end: 12px; color: var(--tone); font-size: 20px; }
.action-row ion-label strong { display: block; font-size: 14px; font-weight: 600; }
.action-row ion-chip {
  height: 24px;
  margin: 4px 0 0;
  padding-inline: 10px;
  background: color-mix(in srgb, var(--ion-text-color) 6%, transparent);
  color: var(--ep-glass-muted);
  font-size: 12px;
}
.action-row__resolved { color: var(--ep-success-text); font-size: 22px; }
</style>
