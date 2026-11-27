<script setup lang="ts">
// The bar over the rows while some are selected: how many, and «Clear». The table keeps the selection.
import { IonButton, IonIcon } from '@ionic/vue';

import type { DataTableLabels } from './types';
import { usePartChrome } from './usePartChrome';

const props = withDefaults(
  defineProps<{
    /** How many rows are selected. */
    count: number;
    labels?: Partial<DataTableLabels>;
  }>(),
  { labels: undefined },
);

const emit = defineEmits<{ clear: [] }>();

const { ICONS, icon, label } = usePartChrome(props);
</script>

<template>
  <div class="data-table__selection-bar">
    <strong>{{ label('selected', { n: count }) }}</strong>
    <ion-button
      class="data-table__selection-clear"
      fill="clear"
      size="small"
      :aria-label="label('clear')"
      :title="label('clear')"
      @click="emit('clear')"
    >
      <ion-icon
        slot="icon-only"
        :icon="icon(ICONS.clear)"
        style="font-size: 14px"
        aria-hidden="true"
      />
    </ion-button>
  </div>
</template>

<style scoped src="./controls.css"></style>

<style scoped>
.data-table__selection-bar { display: flex; align-items: center; gap: 0.6rem; padding: 0.4rem 0.7rem; border-radius: 10px; font-size: 13px; color: var(--primary); background: color-mix(in srgb, var(--primary) 12%, transparent); }
/* `padding: revert`: the browser's own button padding, which normalize.css would zero. */
.data-table__selection-clear { margin-left: auto; display: inline-flex; align-items: center; gap: 0.25rem; cursor: pointer; font-weight: 500; color: inherit; background: none; border: 0; font: inherit; padding: revert; }
.data-table__selection-clear:hover { text-decoration: underline; }
</style>
