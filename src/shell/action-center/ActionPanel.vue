<script setup lang="ts">
import { IonButton, IonButtons, IonContent, IonHeader, IonList, IonModal, IonSpinner, IonToolbar } from '@ionic/vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import EmptyState from '../../components/EmptyState/EmptyState.vue';
import InlineFeedback from '../../components/InlineFeedback/InlineFeedback.vue';
import HubIcon from '../HubIcon.vue';
import type { NoticeActionSlot } from './actions';
import ActionFeatured from './ActionFeatured.vue';
import ActionRow from './ActionRow.vue';
import { useActionCenter } from './center';
import { bellOnView } from './flight';
import { useNoticeAction } from './notice-action';
import { panelEnterAnimation, panelLeaveAnimation } from './panel-motion';

const {
  loading,
  failed,
  retry,
  total,
  mostUrgent,
  dueProgress,
  featured,
  rows,
  resolved,
  busy,
  allClear,
  open,
  closePanel,
  feature,
} = useActionCenter();
const { run } = useNoticeAction();
const { t } = useI18n();
const countKnown = computed(() => !loading.value && !(failed.value && !featured.value));
const heading = computed(() =>
  countKnown.value ? t('actionCenter.panel.count', { count: total.value }, total.value) : t('actionCenter.panel.title'),
);
const featuredProgress = computed(() =>
  featured.value && featured.value.id === mostUrgent.value?.id ? dueProgress.value : undefined,
);

function onAction(which: NoticeActionSlot, event: Event): void {
  if (featured.value) void run(featured.value, which, event);
}

// Ionic's button keeps its focusable <button> in its shadow root; its host takes no focus.
function focusBell(): void {
  const bell = bellOnView();
  (bell?.shadowRoot?.querySelector<HTMLElement>('button') ?? bell)?.focus();
}

// During `didDismiss` Ionic's focus trap still pulls focus back into the dialog, and right after it restores the focus
// it found on opening: the bell takes it on the next task, once Ionic has let the dialog go.
function onDidDismiss(): void {
  closePanel();
  setTimeout(focusBell);
}
</script>

<template>
  <ion-modal
    class="action-panel"
    :is-open="open"
    :enter-animation="panelEnterAnimation"
    :leave-animation="panelLeaveAnimation"
    :backdrop-dismiss="true"
    aria-labelledby="action-panel-title"
    data-testid="action-panel"
    @did-dismiss="onDidDismiss"
  >
    <ion-header class="ion-no-border action-panel__header">
      <ion-toolbar>
        <div class="action-panel__heading">
          <h2 id="action-panel-title">
            {{ heading }}
          </h2>
          <p v-if="countKnown && total > 0">
            {{ t('actionCenter.panel.subtitle') }}
          </p>
        </div>
        <ion-buttons slot="end">
          <ion-button
            class="action-panel__close"
            fill="clear"
            :aria-label="t('actionCenter.panel.close')"
            data-testid="action-panel-close"
            @click="closePanel"
          >
            <HubIcon
              slot="icon-only"
              name="ion:close-outline"
            />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="action-panel__content">
      <div
        v-if="loading"
        class="action-panel__loading"
        data-testid="action-panel-loading"
        role="status"
      >
        <ion-spinner name="crescent" />
        <span>{{ t('actionCenter.panel.loading') }}</span>
      </div>
      <div
        v-else-if="failed && !featured"
        class="action-panel__state is-error"
        data-testid="action-panel-error"
        role="alert"
      >
        <EmptyState
          icon="alert-circle-outline"
          :heading="t('actionCenter.panel.errorTitle')"
          :message="t('actionCenter.panel.errorBody')"
        >
          <template #action>
            <ion-button
              class="action-panel__retry"
              data-testid="action-panel-retry"
              @click="retry"
            >
              {{ t('actionCenter.panel.retry') }}
            </ion-button>
          </template>
        </EmptyState>
      </div>
      <div
        v-else-if="allClear || !featured"
        class="action-panel__state is-clear"
        data-testid="action-panel-empty"
        role="status"
      >
        <EmptyState
          icon="checkmark-circle-outline"
          :heading="t('actionCenter.panel.emptyTitle')"
          :message="t('actionCenter.panel.emptyBody')"
        />
      </div>
      <div
        v-else
        class="action-panel__list"
      >
        <InlineFeedback
          v-if="failed"
          class="action-panel__stale"
          tone="warning"
          role="alert"
          data-testid="action-panel-stale"
        >
          {{ t('actionCenter.panel.stale') }}
          <template #actions>
            <ion-button
              fill="clear"
              data-testid="action-panel-retry"
              @click="retry"
            >
              {{ t('actionCenter.panel.retry') }}
            </ion-button>
          </template>
        </InlineFeedback>
        <ActionFeatured
          :key="featured.id"
          :notice="featured"
          :due-progress="featuredProgress"
          :busy="busy.has(featured.id)"
          :resolved="resolved.has(featured.id)"
          @action="onAction"
        />
        <ion-list
          lines="none"
          class="action-panel__rows"
        >
          <ActionRow
            v-for="notice in rows"
            :key="notice.id"
            :notice="notice"
            :resolved="resolved.has(notice.id)"
            @select="feature"
          />
        </ion-list>
      </div>
    </ion-content>
  </ion-modal>
</template>

<style scoped>
.action-panel { --background: transparent; --backdrop-opacity: 0.12; }
.action-panel::part(content) {
  position: absolute;
  top: calc(var(--ion-safe-area-top, 0px) + 72px);
  right: 16px;
  bottom: 16px;
  width: 400px;
  height: auto;
  overflow: hidden;
  border: 1px solid var(--ep-glass-border);
  border-radius: 28px;
  background: var(--ep-glass-bg);
  -webkit-backdrop-filter: var(--ep-glass-backdrop);
  backdrop-filter: var(--ep-glass-backdrop);
  box-shadow: inset 0 1px 0 var(--ep-glass-highlight), var(--ep-shadow-float);
}
.action-panel__header { position: relative; z-index: 1; }
.action-panel__header ion-toolbar { --background: transparent; --min-height: 66px; padding-inline: 8px 4px; }
.action-panel__heading { flex: 1; min-width: 0; padding-inline-start: 8px; }
.action-panel__heading h2 { margin: 0; color: var(--ion-text-color); font-size: 17px; font-weight: 700; letter-spacing: -0.02em; }
.action-panel__heading p { margin: 2px 0 0; color: var(--ep-glass-muted); font-size: 12px; }
.action-panel__close { min-width: 48px; min-height: 48px; margin: 0; --color: var(--ion-text-color); font-size: 22px; }
.action-panel__close:active::part(native) { transform: scale(0.97); }
.action-panel__content { --background: transparent; --padding-start: 12px; --padding-end: 12px; --padding-bottom: 12px; }
.action-panel__rows { display: grid; gap: 4px; padding: 0; background: transparent; }
.action-panel__list { display: grid; gap: 10px; }
.action-panel__stale { margin: 0; }
.action-panel__loading { display: grid; place-content: center; justify-items: center; gap: 12px; height: 100%; color: var(--ep-glass-muted); font-size: 13px; }
.action-panel__state { display: grid; align-content: center; height: 100%; }
.action-panel__state :deep(.empty-state) { --message-color: var(--ep-glass-muted); --heading-color: var(--ion-text-color); }
.action-panel__state.is-clear :deep(.empty-state) { --icon-color: var(--ep-success-text); }
.action-panel__state.is-error :deep(.empty-state) { --icon-color: var(--ep-danger-text); }
.action-panel__retry { --background: var(--ep-action-bg); --color: var(--ep-action-text); --border-radius: 16px; }
@media (max-width: 599px) {
  .action-panel::part(content) {
    top: calc(var(--ion-safe-area-top, 0px) + 60px);
    right: 0;
    bottom: 0;
    left: 0;
    width: 100%;
    padding-bottom: var(--ion-safe-area-bottom, 0px);
    border-right: 0;
    border-bottom: 0;
    border-radius: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .action-panel::part(content) { scroll-behavior: auto; }
}
</style>
