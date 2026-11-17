<script setup lang="ts">
// One toast as the stack paints it: a pill of dark glass (light on a dark theme) with the icon of its tone, its
// message, its action and, when it does not leave by itself or is an error, a close button. It says what the person
// does with it (`dismiss`, `action`, `tap`) and the stack acts on it; where it sits comes from the stack.
import { IonButton } from '@ionic/vue';
import { computed, nextTick, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import HubIcon from './HubIcon.vue';
import { createSwipe, type SwipeAway, type SwipeOut } from './toast-motion';
import type { Toast, ToastTone } from './toast-store';

const props = defineProps<{
  toast: Toast;
  /** The way a vertical slide dismisses it: away from the edge its stack sits on. */
  away: SwipeAway;
}>();

const emit = defineEmits<{
  dismiss: [];
  action: [];
  /** A finger tapped it without sliding: the stack opens, as hovering does with a mouse. */
  tap: [];
}>();

const TONE_ICONS: Record<ToastTone, string> = {
  success: 'ion:checkmark-circle',
  error: 'ion:alert-circle',
  info: 'ion:information-circle',
  warning: 'ion:warning',
};

const { t } = useI18n();

const closable = computed(() => props.toast.duration === 0 || props.toast.tone === 'error');
const buttons = computed(() => closable.value || props.toast.action !== undefined);

const drag = ref({ x: 0, y: 0 });
const dragging = ref(false);
/** The side it was slid off to, which its leave goes on. */
const leaving = ref<SwipeOut>();
let swipe: ReturnType<typeof createSwipe> | undefined;

const point = (event: PointerEvent) => ({ x: event.clientX, y: event.clientY, t: performance.now() });

function onPointerDown(event: PointerEvent): void {
  if (event.button !== 0 || (event.target as Element).closest('ion-button')) return;
  swipe = createSwipe(props.away, point(event));
  (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
}

function onPointerMove(event: PointerEvent): void {
  if (!swipe) return;
  drag.value = swipe.move(point(event));
  dragging.value = swipe.moved;
}

async function onPointerUp(event: PointerEvent): Promise<void> {
  const gesture = swipe;
  if (!gesture) return;
  swipe = undefined;
  dragging.value = false;
  const out = gesture.end(performance.now());
  if (out) {
    leaving.value = out;
    await nextTick();
    emit('dismiss');
    return;
  }
  drag.value = { x: 0, y: 0 };
  if (!gesture.moved && event.pointerType === 'touch') emit('tap');
}

function onPointerCancel(): void {
  swipe = undefined;
  dragging.value = false;
  drag.value = { x: 0, y: 0 };
}
</script>

<template>
  <div
    class="ep-toast"
    :class="{ 'is-dragging': dragging, 'has-buttons': buttons }"
    :role="toast.tone === 'error' ? 'alert' : 'status'"
    tabindex="0"
    data-testid="toast"
    :data-tone="toast.tone"
    :data-toast-id="toast.id"
    :data-swipe="leaving"
    :style="{ '--drag-x': `${drag.x}px`, '--drag-y': `${drag.y}px` }"
    @keydown.esc.stop="emit('dismiss')"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
  >
    <div class="ep-toast__body">
      <HubIcon
        class="ep-toast__icon"
        :name="TONE_ICONS[toast.tone]"
      />
      <span class="ep-toast__message">{{ toast.message }}</span>
      <ion-button
        v-if="toast.action"
        fill="clear"
        class="ep-toast__action"
        @click="emit('action')"
      >
        {{ toast.action.label }}
      </ion-button>
      <ion-button
        v-if="closable"
        fill="clear"
        class="ep-toast__close"
        :aria-label="t('toast.close')"
        @click="emit('dismiss')"
      >
        <HubIcon
          slot="icon-only"
          name="ion:close-outline"
        />
      </ion-button>
    </div>
  </div>
</template>

<style scoped>
.ep-toast {
  --tone: var(--ep-toast-info);
  border-radius: var(--ep-radius-pill);
  background: var(--ep-toast-bg);
  -webkit-backdrop-filter: var(--ep-glass-backdrop);
  backdrop-filter: var(--ep-glass-backdrop);
  /* The border is a shadow, so it takes no room and the measured height is the content's. */
  box-shadow: inset 0 0 0 1px var(--ep-toast-border), inset 0 1px 0 var(--ep-toast-border), var(--ep-shadow-float);
  color: var(--ep-toast-text);
  overflow: hidden;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

.ep-toast:focus-visible {
  outline: none;
  box-shadow: var(--ep-focus-ring), inset 0 0 0 1px var(--ep-toast-border), var(--ep-shadow-float);
}

.ep-toast[data-tone='success'] {
  --tone: var(--ep-toast-success);
}

.ep-toast[data-tone='error'] {
  --tone: var(--ep-toast-error);
}

.ep-toast[data-tone='warning'] {
  --tone: var(--ep-toast-warning);
}

.ep-toast__body {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 56px;
  padding: 4px 18px 4px 16px;
  transition: opacity 180ms var(--ep-ease-out);
}

.ep-toast.has-buttons .ep-toast__body {
  padding-right: 4px;
}

.ep-toast__icon {
  flex: none;
  font-size: 20px;
  color: var(--tone);
}

.ep-toast__message {
  flex: 1;
  min-width: 0;
  margin-block: 8px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
  /* One line, two when it is long, cut between words. */
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  overflow-wrap: break-word;
}

.ep-toast ion-button {
  flex: none;
  min-width: 48px;
  min-height: 48px;
  margin: 0;
  --border-radius: var(--ep-radius-pill);
  --color: var(--tone);
  --color-hover: var(--tone);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: none;
}

.ep-toast ion-button::part(native) {
  transition: transform 150ms var(--ep-ease-out);
}

.ep-toast ion-button:active::part(native) {
  transform: scale(0.97);
}

.ep-toast ion-button.ep-toast__close {
  --color: var(--ep-toast-muted);
  --color-hover: var(--ep-toast-text);
  font-size: 20px;
}

.ep-toast ion-button:focus-visible {
  outline: 2px solid var(--tone);
  outline-offset: -2px;
  border-radius: var(--ep-radius-pill);
}
</style>
