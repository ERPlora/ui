<script setup lang="ts">
import { IonBadge, IonButton, IonChip } from '@ionic/vue';
import { computed, nextTick, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { cssZoomOf } from '../css-zoom';
import HubIcon from '../HubIcon.vue';
import { useActionCenter } from './center';
import type { NoticeSeverity } from './types';

defineProps<{
  /** On a phone's bar, the room of one button: the count rides on the bell as a badge, without the severity icon. */
  compact?: boolean;
}>();

const SEVERITY_ICONS: Record<NoticeSeverity, string> = {
  danger: 'ion:alert-circle',
  warning: 'ion:warning',
  info: 'ion:information-circle',
};

const { loading, failed, total, topSeverity, mostUrgent, dueProgress, open, pulse, openPanel, closePanel } =
  useActionCenter();
const { t } = useI18n();
const pulsing = shallowRef(false);
let pulseTimer: ReturnType<typeof setTimeout> | undefined;

const accessibleName = computed(() => {
  if (loading.value) return t('actionCenter.bell.loading');
  if (!total.value || !topSeverity.value) return t(failed.value ? 'actionCenter.bell.failed' : 'actionCenter.bell.empty');
  return t(
    'actionCenter.bell.pending',
    {
      severity: t(`actionCenter.severity.${topSeverity.value}`),
      label: mostUrgent.value?.label ?? '',
      count: total.value,
    },
    total.value,
  );
});
const dueRemaining = computed(() => Math.max(0, 1 - (dueProgress.value ?? 0)));
const ringStyle = computed(() => ({ '--due-remaining': String(dueRemaining.value) }));
const bell = useTemplateRef<{ $el: HTMLElement }>('bell');
const hovering = shallowRef(false);
const hoverStyle = shallowRef<Record<string, string>>({});

function showHover(event: PointerEvent): void {
  if (event.pointerType === 'touch') return;
  const el = bell.value?.$el;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const zoom = cssZoomOf(el);
  hoverStyle.value = { top: `${rect.bottom / zoom + 6}px`, right: `${(window.innerWidth - rect.right) / zoom}px` };
  hovering.value = true;
}

function syncExpanded(expanded: boolean): void {
  const el = bell.value?.$el;
  el?.setAttribute('aria-expanded', String(expanded));
  el?.shadowRoot?.querySelector('button')?.setAttribute('aria-expanded', String(expanded));
}
onMounted(() => syncExpanded(open.value));
watch(open, syncExpanded, { flush: 'post' });

watch(pulse, async () => {
  pulsing.value = false;
  clearTimeout(pulseTimer);
  await nextTick();
  pulsing.value = true;
  pulseTimer = setTimeout(() => (pulsing.value = false), 450);
});

onBeforeUnmount(() => clearTimeout(pulseTimer));
</script>

<template>
  <span
    class="action-bell-wrap"
    @pointerenter="showHover"
    @pointerleave="hovering = false"
  >
    <ion-button
      ref="bell"
      fill="clear"
      class="action-bell"
      :class="{ 'has-notices': total > 0, 'is-pulsing': pulsing, 'is-compact': compact }"
      :data-severity="topSeverity"
      :aria-expanded="String(open)"
      data-action-bell
      data-testid="action-bell"
      @click="open ? closePanel() : openPanel()"
    >
      <span class="action-bell__name">{{ accessibleName }}</span>
      <HubIcon
        v-if="!total"
        slot="icon-only"
        name="ion:notifications-outline"
      />
      <span
        v-else
        class="action-bell__pill"
      >
        <span
          class="action-bell__ring"
          :style="ringStyle"
          :data-progress="dueRemaining"
        >
          <HubIcon name="ion:notifications-outline" />
        </span>
        <ion-badge class="action-bell__count">{{ total }}</ion-badge>
        <HubIcon
          v-if="topSeverity && !compact"
          class="action-bell__severity"
          :name="SEVERITY_ICONS[topSeverity]"
        />
      </span>
    </ion-button>
    <Teleport to="body">
      <span
        v-if="mostUrgent"
        class="action-bell__hover ep-glass"
        :class="{ 'is-visible': hovering }"
        :style="hoverStyle"
        aria-hidden="true"
      >
        <span>{{ mostUrgent.title }}</span>
        <ion-chip v-if="mostUrgent.chip">{{ mostUrgent.chip }}</ion-chip>
      </span>
    </Teleport>
  </span>
</template>

<style scoped>
.action-bell-wrap { position: relative; z-index: 80; display: inline-flex; }
.action-bell {
  --tone: var(--ep-primary-text);
  min-width: 48px;
  min-height: 48px;
  margin: 0;
  overflow: visible;
  --overflow: visible;
}
.action-bell.has-notices {
  --padding-start: 4px;
  --padding-end: 4px;
  --background: transparent;
  --background-hover: transparent;
  --background-activated: transparent;
  --background-focused: transparent;
  --color: var(--tone);
}
.action-bell[data-severity='danger'] { --tone: var(--ep-danger-text); }
.action-bell[data-severity='warning'] { --tone: var(--ep-warning-text); }
.action-bell[data-severity='info'] { --tone: var(--ep-primary-text); }
.action-bell__name {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
.action-bell__pill {
  position: relative;
  isolation: isolate;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 40px;
  padding: 0 10px 0 4px;
  border-radius: var(--ep-radius-pill);
  background: color-mix(in srgb, var(--tone) 12%, transparent);
  transition: transform 150ms var(--ep-ease-out), background-color 150ms var(--ep-ease-out);
}
.action-bell.ion-focused .action-bell__pill { outline: 2px solid var(--tone); outline-offset: 2px; }
.action-bell__ring { position: relative; display: grid; place-items: center; width: 32px; height: 32px; flex: none; }
.action-bell__ring::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: conic-gradient(var(--tone) calc(var(--due-remaining, 1) * 100%), color-mix(in srgb, var(--tone) 22%, transparent) 0);
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2.5px));
  mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2.5px));
}
.action-bell__ring ion-icon { font-size: 18px; }
.action-bell__count {
  --background: transparent;
  --color: var(--tone);
  --padding-start: 0;
  --padding-end: 0;
  --padding-top: 0;
  --padding-bottom: 0;
  min-width: 1ch;
  font-size: 15px;
  font-weight: 750;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.action-bell__severity { flex: none; font-size: 16px; color: var(--tone); }
.action-bell.is-compact .action-bell__pill { padding: 4px; }
.action-bell.is-compact .action-bell__count {
  --background: var(--tone);
  --color: var(--ion-background-color);
  --padding-start: 4px;
  --padding-end: 4px;
  position: absolute;
  top: 0;
  inset-inline-end: -2px;
  min-width: 18px;
  height: 18px;
  border-radius: var(--ep-radius-pill);
  box-shadow: 0 0 0 2px var(--ion-background-color);
  font-size: 12px;
  line-height: 18px;
}
.action-bell__hover {
  position: fixed;
  z-index: 60020;
  display: flex;
  align-items: center;
  gap: 8px;
  width: max-content;
  max-width: min(420px, calc(100vw - 24px));
  min-height: 42px;
  padding: 6px 6px 6px 14px;
  border-radius: var(--ep-radius-pill);
  color: var(--ion-text-color);
  visibility: hidden;
  pointer-events: none;
  transform: translateY(-5px);
  transition: transform 200ms var(--ep-ease-out), visibility 200ms;
  font-size: 13px;
  font-weight: 650;
}
.action-bell__hover > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.action-bell__hover ion-chip { flex: none; height: 28px; margin: 0; font-size: 12px; }
.action-bell.has-notices[data-severity='danger'] .action-bell__pill::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  box-shadow: 0 0 16px color-mix(in srgb, var(--ion-color-danger) 34%, transparent);
  animation: action-bell-breathe 4s ease-in-out infinite;
}
.action-bell.is-pulsing .action-bell__pill { animation: action-bell-pulse 450ms var(--ep-ease-out); }
.action-bell:active .action-bell__pill { transform: scale(0.97); }
@keyframes action-bell-breathe { 0%, 100% { scale: 0.96; } 50% { scale: 1.04; } }
@keyframes action-bell-pulse { 0% { transform: scale(0.94); } 65% { transform: scale(1.05); } 100% { transform: scale(1); } }
@media (hover: hover) and (pointer: fine) {
  .action-bell__hover.is-visible { visibility: visible; transform: translateY(0); }
  .action-bell.has-notices:hover .action-bell__pill { background: color-mix(in srgb, var(--tone) 18%, transparent); }
}
@media (prefers-reduced-motion: reduce) {
  .action-bell__pill::after { animation: none; }
  .action-bell.is-pulsing .action-bell__pill { animation: none; }
}
</style>
