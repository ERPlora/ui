<script setup lang="ts">
import { IonButton, IonSpinner } from '@ionic/vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import HubIcon from '../HubIcon.vue';
import type { NoticeActionSlot } from './actions';
import type { ActionNotice } from './types';

const props = withDefaults(
  defineProps<{
    notice: ActionNotice;
    dueProgress?: number;
    busy?: boolean;
    resolved?: boolean;
  }>(),
  { dueProgress: undefined, busy: false, resolved: false },
);
const emit = defineEmits<{ action: [which: NoticeActionSlot, event: Event] }>();
const { t } = useI18n();
const remaining = computed(() => Math.max(0, 1 - (props.dueProgress ?? 0)));
const ringStyle = computed(() => ({ '--due-remaining': String(remaining.value) }));
const hasAction = computed(() => props.notice.action !== undefined);
</script>

<template>
  <article
    class="action-featured"
    :data-severity="notice.severity"
    :data-resolved="resolved ? 'true' : undefined"
    data-testid="action-featured"
  >
    <div class="action-featured__kicker">
      <span class="action-featured__symbol"><HubIcon :name="notice.icon" /></span>
      <span>{{ t(`actionCenter.severity.${notice.severity}`) }}<template v-if="notice.chip"> · {{ notice.chip }}</template></span>
    </div>
    <h3>{{ notice.title }}</h3>
    <div
      v-if="notice.figure || (notice.due && dueProgress !== undefined)"
      class="action-featured__data"
    >
      <span
        v-if="notice.figure"
        class="action-featured__figure"
      >{{ notice.figure }}</span>
      <span
        v-if="notice.due && dueProgress !== undefined"
        class="action-featured__ring"
        :style="ringStyle"
        aria-hidden="true"
      ><HubIcon name="ion:time-outline" /></span>
    </div>
    <p
      v-if="notice.body"
      class="action-featured__body"
    >
      {{ notice.body }}
    </p>
    <div
      v-if="resolved"
      class="action-featured__done"
      role="status"
    >
      <HubIcon
        class="action-featured__check"
        name="ion:checkmark-outline"
      />
      {{ t('actionCenter.resolved') }}
    </div>
    <div
      v-else-if="hasAction"
      class="action-featured__actions"
    >
      <ion-button
        class="action-featured__primary"
        expand="block"
        :href="notice.action?.href"
        :target="notice.action?.href ? '_blank' : undefined"
        :rel="notice.action?.href ? 'noopener' : undefined"
        :disabled="busy"
        @click="emit('action', 'primary', $event)"
      >
        <ion-spinner
          v-if="busy"
          name="crescent"
        />
        <span>{{ busy ? t('actionCenter.processing') : notice.action?.label }}</span>
        <HubIcon
          v-if="!busy"
          slot="end"
          name="ion:chevron-forward-outline"
        />
      </ion-button>
      <ion-button
        v-if="notice.secondary && !busy"
        class="action-featured__secondary"
        fill="clear"
        :href="notice.secondary.href"
        :target="notice.secondary.href ? '_blank' : undefined"
        :rel="notice.secondary.href ? 'noopener' : undefined"
        @click="emit('action', 'secondary', $event)"
      >
        {{ notice.secondary.label }}
      </ion-button>
    </div>
  </article>
</template>

<style scoped>
.action-featured {
  --tone: var(--ep-primary-text);
  padding: 18px;
  border-radius: 20px;
  background: color-mix(in srgb, var(--ion-card-background) 60%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ep-glass-border) 60%, transparent);
  animation: action-featured-in 360ms var(--ep-spring) both;
}
.action-featured[data-severity='danger'] { --tone: var(--ep-danger-text); }
.action-featured[data-severity='warning'] { --tone: var(--ep-warning-text); }
.action-featured__kicker { display: flex; align-items: center; gap: 10px; }
.action-featured__symbol {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 15px;
  background: color-mix(in srgb, var(--tone) 11%, transparent);
  color: var(--tone);
  font-size: 23px;
}
.action-featured__kicker > span:last-child { color: var(--tone); font-size: 11px; font-weight: 750; letter-spacing: 0.07em; text-transform: uppercase; }
.action-featured h3 { margin: 16px 0 0; font-size: 17px; line-height: 1.3; font-weight: 650; letter-spacing: -0.025em; }
.action-featured__data { display: flex; align-items: center; gap: 16px; min-height: 64px; margin-top: 8px; }
.action-featured__figure { font-size: 32px; line-height: 1; font-weight: 700; letter-spacing: -0.05em; font-variant-numeric: tabular-nums; }
.action-featured__ring {
  position: relative;
  display: grid;
  place-items: center;
  flex: none;
  width: 44px;
  height: 44px;
  margin-left: auto;
  color: var(--tone);
}
.action-featured__ring::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: conic-gradient(var(--tone) calc(var(--due-remaining) * 100%), color-mix(in srgb, var(--tone) 16%, transparent) 0);
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3.5px));
  mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3.5px));
}
.action-featured__ring ion-icon { font-size: 20px; }
.action-featured__body { margin: 4px 0 0; color: var(--ep-glass-muted); font-size: 13px; line-height: 1.55; }
.action-featured__actions { display: grid; gap: 2px; margin-top: 14px; }
.action-featured__primary {
  min-height: 50px;
  margin: 0;
  --background: var(--ep-action-bg);
  --color: var(--ep-action-text);
  --border-radius: 16px;
  font-weight: 700;
  box-shadow: 0 8px 24px color-mix(in srgb, var(--ion-color-primary) 24%, transparent);
}
.action-featured__secondary { justify-self: center; min-height: 48px; margin: 0; --color: var(--ep-primary-text); font-size: 13px; font-weight: 650; }
.action-featured__primary:active::part(native), .action-featured__secondary:active::part(native) { transform: scale(0.97); }
.action-featured__primary ion-spinner { width: 19px; height: 19px; }
.action-featured__check { clip-path: inset(0 100% 0 0); animation: action-featured-check 400ms var(--ep-ease-out) forwards; }
.action-featured__done { display: flex; justify-content: center; align-items: center; gap: 8px; min-height: 50px; margin-top: 14px; color: var(--ep-success-text); font-size: 15px; font-weight: 700; }
.action-featured__done ion-icon { font-size: 22px; }
@keyframes action-featured-in { from { transform: translateY(-8px) scale(0.98); } to { transform: translateY(0) scale(1); } }
@keyframes action-featured-check { to { clip-path: inset(0 0 0 0); } }
@media (prefers-reduced-motion: reduce) {
  .action-featured, .action-featured__check { animation: none; clip-path: none; }
}
</style>
