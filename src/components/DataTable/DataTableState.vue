<script setup lang="ts">
import { IonButton, IonSkeletonText } from '@ionic/vue';

import EmptyState from '../EmptyState/EmptyState.vue';
import InlineFeedback from '../InlineFeedback/InlineFeedback.vue';
import { DATA_TABLE_ICONS } from './model';

interface StateLabels {
  loading: string;
  errorTitle: string;
  empty: string;
  retry: string;
  reset: string;
}

withDefaults(
  defineProps<{
    kind: 'loading' | 'error' | 'empty';
    labels: StateLabels;
    errorReason?: string;
    canReset?: boolean;
    testid?: string;
  }>(),
  { errorReason: '', canReset: false, testid: undefined },
);

const emit = defineEmits<{ retry: []; reset: [] }>();
defineSlots<{ empty?: () => unknown }>();
</script>

<template>
  <div
    v-if="kind === 'loading'"
    class="data-table__loading"
    role="status"
    data-role="loading"
    :data-testid="testid ? `${testid}-loading` : undefined"
  >
    <span class="data-table__loading-label">{{ labels.loading }}</span>
    <div
      class="data-table__skeletons"
      aria-hidden="true"
    >
      <div
        v-for="n in 3"
        :key="n"
        class="data-table__skeleton-card"
      >
        <ion-skeleton-text
          animated
          class="data-table__skeleton-icon"
        />
        <div class="data-table__skeleton-lines">
          <ion-skeleton-text
            animated
            style="width: 62%"
          />
          <ion-skeleton-text
            animated
            style="width: 88%"
          />
        </div>
      </div>
    </div>
  </div>
  <div
    v-else-if="kind === 'error'"
    class="data-table__error"
    data-role="load-error"
  >
    <InlineFeedback
      tone="danger"
      :heading="labels.errorTitle"
    >
      <span
        v-if="errorReason"
        class="data-table__error-reason"
      >{{ errorReason }}</span>
      <template #actions>
        <ion-button
          size="small"
          data-role="load-error-retry"
          :data-testid="testid ? `${testid}-retry` : undefined"
          @click="emit('retry')"
        >
          {{ labels.retry }}
        </ion-button>
      </template>
    </InlineFeedback>
  </div>
  <div
    v-else
    class="data-table__empty"
  >
    <slot name="empty">
      <EmptyState
        :icon="DATA_TABLE_ICONS.empty"
        :heading="labels.empty"
      >
        <ion-button
          v-if="canReset"
          fill="clear"
          data-role="no-matches-reset"
          :data-testid="testid ? `${testid}-show-all` : undefined"
          @click="emit('reset')"
        >
          {{ labels.reset }}
        </ion-button>
      </EmptyState>
    </slot>
  </div>
</template>

<style scoped>
/* Room in the table for the library's notices; the boxes are theirs. */
.data-table__empty, .data-table__error, .data-table__loading { display: flex; flex-direction: column; justify-content: center; padding: 2rem 1rem; }
.data-table__loading { align-items: center; gap: 0.75rem; padding: 3.5rem 1rem; text-align: center; color: var(--color-muted); }
.data-table__empty ion-button, .data-table__error ion-button { min-height: 44px; }
.data-table__loading-label { color: var(--color-muted); font-size: 0.875rem; text-align: center; }
.data-table__skeletons { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr)); gap: 0.75rem; width: 100%; }
.data-table__skeleton-card { display: flex; align-items: center; gap: 0.75rem; min-height: 108px; padding: 1rem; border: 1px solid var(--border-color-soft); border-radius: var(--ep-radius-lg); background: var(--background); }
.data-table__skeleton-icon { flex: none; width: 44px; height: 44px; margin: 0; border-radius: var(--ep-radius-sm); }
.data-table__skeleton-lines { flex: 1; display: grid; gap: 0.65rem; }
.data-table__skeleton-lines ion-skeleton-text { height: 12px; margin: 0; border-radius: 6px; }
</style>
