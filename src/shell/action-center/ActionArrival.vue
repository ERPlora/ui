<script setup lang="ts">
import { IonButton, IonProgressBar, IonSpinner } from '@ionic/vue';
import { computed, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import HubIcon from '../HubIcon.vue';
import { createSwipe, type SwipePoint } from '../toast-motion';
import { useActionCenter } from './center';
import { flyToBell } from './flight';
import { useNoticeAction } from './notice-action';

const { arrival, pulse, busy, openPanel, pauseArrival, resumeArrival, settleArrival, holdArrivals, releaseArrivals } =
  useActionCenter();
const { run } = useNoticeAction();
const { t } = useI18n();
const card = useTemplateRef<HTMLElement>('card');
const hovered = shallowRef(false);
const focused = shallowRef(false);
const gesturing = shallowRef(false);
const drag = shallowRef(0);
const flying = shallowRef(false);
const paused = computed(() => hovered.value || focused.value || gesturing.value);
let swipe: ReturnType<typeof createSwipe> | undefined;
let suppressClick = false;

watch(paused, (value) => (value ? pauseArrival() : resumeArrival()), { flush: 'sync' });
watch(
  [arrival, pulse],
  ([next, nextPulse], [previous, previousPulse]) => {
    if (next) flying.value = false;
    else if (previous && nextPulse !== previousPulse && card.value) {
      flying.value = true;
      flyToBell(card.value);
    }
  },
  { flush: 'pre' },
);

function onFocusOut(event: FocusEvent): void {
  if (!card.value?.contains(event.relatedTarget as Node | null)) focused.value = false;
}

function point(event: PointerEvent): SwipePoint {
  return { x: event.clientX, y: event.clientY, t: performance.now() };
}

function onPointerDown(event: PointerEvent): void {
  if (event.button !== 0 || (event.target as Element).closest('ion-button')) return;
  swipe = createSwipe('up', point(event));
  gesturing.value = true;
  card.value?.setPointerCapture?.(event.pointerId);
}

function onPointerMove(event: PointerEvent): void {
  if (!swipe) return;
  drag.value = Math.min(0, swipe.move(point(event)).y);
}

function onPointerUp(): void {
  const gesture = swipe;
  if (!gesture) return;
  swipe = undefined;
  suppressClick = gesture.moved;
  gesturing.value = false;
  if (gesture.end(performance.now()) === 'up') settleArrival();
  else drag.value = 0;
}

function onPointerCancel(): void {
  swipe = undefined;
  gesturing.value = false;
  drag.value = 0;
}

function open(): void {
  if (!arrival.value) return;
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  openPanel(arrival.value.id);
}

const motionQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : undefined;
function syncMotion(event: { matches: boolean }): void {
  if (event.matches) holdArrivals('reduced-motion');
  else releaseArrivals('reduced-motion');
}
onMounted(() => {
  if (motionQuery) syncMotion(motionQuery);
  motionQuery?.addEventListener('change', syncMotion);
});
onBeforeUnmount(() => {
  releaseArrivals('reduced-motion');
  resumeArrival();
  motionQuery?.removeEventListener('change', syncMotion);
});
</script>

<template>
  <div class="action-arrival-layer">
    <Transition :name="flying ? 'none' : 'action-arrival'">
      <article
        v-if="arrival"
        ref="card"
        class="action-arrival ep-glass"
        :class="{ 'is-paused': paused, 'is-dragging': gesturing }"
        :role="arrival.severity === 'danger' ? 'alert' : 'status'"
        :data-severity="arrival.severity"
        :style="{ '--arrival-drag': `${drag}px` }"
        data-testid="action-arrival"
        @mouseenter="hovered = true"
        @mouseleave="hovered = false"
        @focusin="focused = true"
        @focusout="onFocusOut"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerCancel"
      >
        <div
          class="action-arrival__body"
          role="button"
          tabindex="0"
          @click="open"
          @keydown.enter.prevent="open"
          @keydown.space.prevent="open"
        >
          <div class="action-arrival__top">
            <span class="action-arrival__symbol">
              <HubIcon
                class="action-arrival__icon"
                :name="arrival.icon"
              />
            </span>
            <div>
              <h3>{{ arrival.title }}</h3>
              <p class="action-arrival__line">
                {{ arrival.body || arrival.chip }}
              </p>
            </div>
          </div>
        </div>
        <div class="action-arrival__actions">
          <ion-button
            v-if="arrival.action"
            class="action-arrival__action"
            fill="clear"
            :href="arrival.action.href"
            :target="arrival.action.href ? '_blank' : undefined"
            :rel="arrival.action.href ? 'noopener' : undefined"
            :disabled="busy.has(arrival.id)"
            @click="run(arrival, 'primary', $event)"
          >
            <ion-spinner
              v-if="busy.has(arrival.id)"
              name="crescent"
            />
            {{ arrival.action.label }}
          </ion-button>
          <ion-button
            class="action-arrival__close"
            fill="clear"
            :aria-label="t('actionCenter.arrival.close')"
            @click="settleArrival"
          >
            <HubIcon
              slot="icon-only"
              name="ion:close-outline"
            />
          </ion-button>
        </div>
        <ion-progress-bar
          class="action-arrival__time"
          :value="1"
        />
      </article>
    </Transition>
  </div>
</template>

<style scoped>
.action-arrival-layer {
  position: fixed;
  top: calc(var(--ion-safe-area-top, 0px) + 72px);
  right: 20px;
  z-index: 60010;
  width: min(380px, calc(100% - 32px));
  pointer-events: none;
}
:global(html.assistant-docked .action-arrival-layer) { right: calc(var(--assistant-width, 0px) + 20px); }
.action-arrival {
  --tone: var(--ep-primary-text);
  position: relative;
  overflow: hidden;
  padding: 16px;
  border-radius: 26px;
  touch-action: pan-y;
  transform: translateY(var(--arrival-drag, 0px));
  pointer-events: auto;
  transition: transform 350ms var(--ep-spring);
}
.action-arrival[data-severity='danger'] { --tone: var(--ep-danger-text); }
.action-arrival[data-severity='warning'] { --tone: var(--ep-warning-text); }
.action-arrival__body { cursor: pointer; border-radius: 14px; }
.action-arrival__body:focus-visible { outline: 2px solid var(--tone); outline-offset: 4px; }
.action-arrival__top { display: flex; align-items: flex-start; gap: 12px; }
.action-arrival__symbol {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  flex: none;
  border-radius: 14px;
  background: color-mix(in srgb, var(--tone) 11%, transparent);
  color: var(--tone);
  font-size: 22px;
}
.action-arrival h3 { margin: 1px 0 0; font-size: 15px; line-height: 1.35; font-weight: 650; letter-spacing: -0.02em; }
.action-arrival p { margin: 4px 0 0; color: var(--ep-glass-muted); font-size: 13px; line-height: 1.45; }
.action-arrival__actions { display: flex; justify-content: flex-end; gap: 6px; margin-top: 8px; padding-left: 54px; }
.action-arrival__actions ion-button { min-height: 44px; margin: 0; --color: var(--ep-primary-text); font-size: 13px; font-weight: 700; }
.action-arrival__actions ion-button:active::part(native) { transform: scale(0.97); }
.action-arrival__actions .action-arrival__close { min-width: 48px; min-height: 48px; --color: var(--ep-glass-muted); font-size: 20px; }
.action-arrival__time {
  position: absolute;
  right: 20px;
  bottom: 7px;
  left: 20px;
  height: 2px;
  margin: 0;
  transform-origin: left;
  animation: action-arrival-countdown 4s linear forwards;
  --progress-background: color-mix(in srgb, var(--tone) 35%, transparent);
  --buffer-background: transparent;
}
.action-arrival.is-paused .action-arrival__time { animation-play-state: paused; }
.action-arrival.is-dragging { transition: none; }
.action-arrival-enter-active { transition: transform 400ms var(--ep-spring); }
.action-arrival-enter-from { transform: translateY(-14px) scale(0.96); }
.action-arrival-leave-active {
  transition: opacity 150ms var(--ep-ease-out);
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}
.action-arrival-leave-to { opacity: 0; }
:global(.action-arrival-ghost) { pointer-events: none; }
@keyframes action-arrival-countdown { to { transform: scaleX(0); } }
@media (max-width: 599px) {
  .action-arrival-layer,
  :global(html.assistant-docked .action-arrival-layer) { right: 12px; width: calc(100% - 24px); }
}
@media (prefers-reduced-motion: reduce) {
  .action-arrival, .action-arrival-enter-active, .action-arrival-leave-active { transition: none; }
}
</style>
