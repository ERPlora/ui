<script setup lang="ts">
import { IonButton, IonIcon, IonSkeletonText } from '@ionic/vue';

import { ionIconSrc } from '../../shell/icons';
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
const icon = ionIconSrc;
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
    role="alert"
    data-role="load-error"
  >
    <span class="data-table__state-icon"><ion-icon
      :icon="icon(DATA_TABLE_ICONS.error)"
      aria-hidden="true"
    /></span>
    <strong class="data-table__error-title">{{ labels.errorTitle }}</strong>
    <span
      v-if="errorReason"
      class="data-table__error-reason"
    >{{ errorReason }}</span>
    <ion-button
      data-role="load-error-retry"
      :data-testid="testid ? `${testid}-retry` : undefined"
      @click="emit('retry')"
    >
      {{ labels.retry }}
    </ion-button>
  </div>
  <div
    v-else
    class="data-table__empty"
  >
    <slot name="empty">
      <span class="data-table__state-icon"><ion-icon
        :icon="icon(DATA_TABLE_ICONS.empty)"
        aria-hidden="true"
      /></span>
      <span>{{ labels.empty }}</span>
      <ion-button
        v-if="canReset"
        fill="clear"
        data-role="no-matches-reset"
        :data-testid="testid ? `${testid}-show-all` : undefined"
        @click="emit('reset')"
      >
        {{ labels.reset }}
      </ion-button>
    </slot>
  </div>
</template>

<style scoped>
.data-table__empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem; padding: 3.5rem 1rem; text-align: center; color: var(--color-muted); }
.data-table__error { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem; padding: 3.5rem 1rem; text-align: center; color: var(--color-muted); }
.data-table__loading { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem; padding: 3.5rem 1rem; text-align: center; color: var(--color-muted); }
.data-table__empty ion-button { min-height: 44px; }
.data-table__loading-label { color: var(--color-muted); font-size: 0.875rem; text-align: center; }
.data-table__skeletons { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr)); gap: 0.75rem; width: 100%; }
.data-table__skeleton-card { display: flex; align-items: center; gap: 0.75rem; min-height: 108px; padding: 1rem; border: 1px solid var(--border-color-soft); border-radius: var(--ep-radius-lg); background: var(--background); }
.data-table__skeleton-icon { flex: none; width: 44px; height: 44px; margin: 0; border-radius: var(--ep-radius-sm); }
.data-table__skeleton-lines { flex: 1; display: grid; gap: 0.65rem; }
.data-table__skeleton-lines ion-skeleton-text { height: 12px; margin: 0; border-radius: 6px; }
.data-table__error .data-table__error-title { color: var(--color); font-weight: 600; }
.data-table__error .data-table__state-icon { color: var(--ion-color-danger, #c5000f); }
.data-table__error ion-button { min-height: 44px; --padding-start: 1rem; --padding-end: 1rem; margin-top: 0.25rem; }
.data-table__empty .data-table__state-icon, .data-table__error .data-table__state-icon { display: grid; place-items: center; width: 3.25rem; height: 3.25rem; border-radius: 999px; background: var(--header-background); font-size: 26px; }
</style>
