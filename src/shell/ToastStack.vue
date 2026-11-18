<script setup lang="ts">
// The one place toasts are painted: the stack of `useToasts()`, at the bottom centre (above the bottom bar of the screen
// on view) and at the top centre. Collapsed, the newest is in front and two more peek behind it; with the mouse over it,
// the focus inside or a tap, it opens into a list and every clock stops until the attention has gone.
import { computed, nextTick, onBeforeUnmount, onMounted, onUpdated, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { useToastAnchor } from './toast-anchor';
import { stackExtent, toastPlacement } from './toast-motion';
import { type Toast, type ToastPosition, useToasts } from './toast-store';
import ToastItem from './ToastItem.vue';

const EDGES: readonly ToastPosition[] = ['bottom', 'top'];
/** Room between the stack and the bottom bar it sits on. */
const ANCHOR_GAP_PX = 12;

const { bottom, top, pause, resume, dismiss, runAction } = useToasts();
const anchor = useToastAnchor(bottom);
const { t } = useI18n();

const lists: Record<ToastPosition, { readonly value: readonly Toast[] }> = { bottom, top };
const sections: Partial<Record<ToastPosition, HTMLElement>> = {};

/** What holds each stack open: the mouse over it, the focus inside it, a finger that tapped it. */
const attention = reactive({
  bottom: { hovered: false, focused: false, touched: false },
  top: { hovered: false, focused: false, touched: false },
});
const expanded = (edge: ToastPosition): boolean => Object.values(attention[edge]).some(Boolean);
watch(
  () => EDGES.some(expanded),
  (held) => (held ? pause() : resume()),
);

const heights = ref<Record<string, number>>({});
const anchorOffset = ref<string>();

/** The height of the content of each toast on screen, and how far up the bottom bar pushes the bottom stack. */
function measure(): void {
  const next: Record<string, number> = {};
  for (const section of Object.values(sections)) {
    for (const el of section.querySelectorAll<HTMLElement>('[data-toast-id]')) {
      next[el.dataset.toastId as string] = el.querySelector<HTMLElement>('.ep-toast__body')?.offsetHeight ?? 0;
    }
  }
  if (JSON.stringify(next) !== JSON.stringify(heights.value)) heights.value = next;
  const bar = anchor.value;
  anchorOffset.value = bar ? `${Math.max(0, window.innerHeight - bar.getBoundingClientRect().top) + ANCHOR_GAP_PX}px` : undefined;
}

const heightsOf = (edge: ToastPosition): number[] => lists[edge].value.map((each) => heights.value[each.id] ?? 0);

function placementStyle(edge: ToastPosition, index: number): Record<string, string | undefined> {
  const { offset, scale, height } = toastPlacement(index, heightsOf(edge), expanded(edge));
  return {
    '--y': `${edge === 'bottom' ? -offset : offset}px`,
    '--scale': String(scale),
    height: index > 0 && height ? `${height}px` : undefined,
    zIndex: String(3 - index),
  };
}

const extentOf = (edge: ToastPosition): string => `${stackExtent(heightsOf(edge), expanded(edge))}px`;

function onPointerEnter(edge: ToastPosition, event: PointerEvent): void {
  if (event.pointerType !== 'touch') attention[edge].hovered = true;
}

function onPointerLeave(edge: ToastPosition, event: PointerEvent): void {
  if (event.pointerType !== 'touch') attention[edge].hovered = false;
}

function onFocusOut(edge: ToastPosition, event: FocusEvent): void {
  if (!sections[edge]?.contains(event.relatedTarget as Node | null)) attention[edge].focused = false;
}

/** A touch outside a stack opened by a tap closes it. */
function onDocumentPointerDown(event: PointerEvent): void {
  for (const edge of EDGES) {
    if (!sections[edge]?.contains(event.target as Node)) attention[edge].touched = false;
  }
}

const toastElement = (edge: ToastPosition, id: string): HTMLElement | undefined =>
  [...(sections[edge]?.querySelectorAll<HTMLElement>('[data-toast-id]') ?? [])].find((el) => el.dataset.toastId === id);

/** The focus on a toast that leaves, closed or pushed out by a new one, goes on to the front toast of its stack. Read
 *  before the toast leaves the page: a focused element that is removed sends no focusout. */
function keepFocus(edge: ToastPosition, now: readonly Toast[]): void {
  const holder = document.activeElement?.closest<HTMLElement>('[data-toast-id]');
  if (!holder || !sections[edge]?.contains(holder) || now.some((each) => each.id === holder.dataset.toastId)) return;
  void nextTick(() => {
    const front = now[0] && toastElement(edge, now[0].id);
    if (front) front.focus();
    else attention[edge].focused = false;
  });
}

// Whatever leaves the stack empty also takes away what held it open: the pointer is no longer over anything.
for (const edge of EDGES) {
  watch(
    () => lists[edge].value,
    (now) => {
      keepFocus(edge, now);
      if (now.length === 0) Object.assign(attention[edge], { hovered: false, focused: false, touched: false });
    },
  );
}

const motionQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : undefined;
const reducedMotion = ref(motionQuery?.matches ?? false);
const onMotionChange = (event: MediaQueryListEvent): void => {
  reducedMotion.value = event.matches;
};
const transitionName = computed(() => (reducedMotion.value ? 'ep-toast-fade' : 'ep-toast'));

onMounted(() => {
  measure();
  window.addEventListener('resize', measure);
  document.addEventListener('pointerdown', onDocumentPointerDown, true);
  motionQuery?.addEventListener?.('change', onMotionChange);
});
onUpdated(measure);
// The bar is found a frame after a toast comes, once whatever the toast came with has changed the screen.
watch(anchor, measure);
onBeforeUnmount(() => {
  if (EDGES.some(expanded)) resume();
  window.removeEventListener('resize', measure);
  document.removeEventListener('pointerdown', onDocumentPointerDown, true);
  motionQuery?.removeEventListener?.('change', onMotionChange);
});

function setSection(edge: ToastPosition, el: unknown): void {
  if (el instanceof HTMLElement) sections[edge] = el;
  else delete sections[edge];
}
</script>

<template>
  <section
    v-for="edge in EDGES"
    :key="edge"
    :ref="(el) => setSection(edge, el)"
    class="ep-toast-stack"
    :class="{ 'is-expanded': expanded(edge), 'is-reduced-motion': reducedMotion }"
    data-testid="toast-stack"
    :data-position="edge"
    :aria-label="t('toast.region')"
    :style="edge === 'bottom' && anchorOffset ? { bottom: anchorOffset } : undefined"
    @focusin="attention[edge].focused = true"
    @focusout="onFocusOut(edge, $event)"
  >
    <TransitionGroup
      tag="div"
      class="ep-toast-stack__list"
      :name="transitionName"
      :style="{ height: extentOf(edge) }"
      @pointerenter="onPointerEnter(edge, $event)"
      @pointerleave="onPointerLeave(edge, $event)"
    >
      <ToastItem
        v-for="(item, index) in lists[edge].value"
        :key="item.id"
        :toast="item"
        :away="edge === 'bottom' ? 'down' : 'up'"
        :class="{ 'is-front': index === 0 }"
        :style="placementStyle(edge, index)"
        @dismiss="dismiss(item.id)"
        @action="runAction(item.id)"
        @tap="attention[edge].touched = true"
      />
    </TransitionGroup>
  </section>
</template>

<style scoped>
.ep-toast-stack {
  position: fixed;
  left: 0;
  right: 0;
  z-index: 60000;
  display: flex;
  justify-content: center;
  padding: 0 16px;
  pointer-events: none;
  transition: right 200ms ease, bottom 200ms ease;
}

.ep-toast-stack[data-position='bottom'] {
  bottom: calc(var(--ion-safe-area-bottom, 0px) + 16px);
}

.ep-toast-stack[data-position='top'] {
  top: calc(var(--ion-safe-area-top, 0px) + 12px);
}

:global(html.assistant-docked .ep-toast-stack) {
  right: var(--assistant-width, 0px);
}

/* As wide as its longest message, from 390 px up to 672 px (Material's snackbar), before a message wraps. The toasts
   share one grid cell, so each sizes the list and all take its width. */
.ep-toast-stack__list {
  position: relative;
  display: grid;
  width: max-content;
  min-width: min(390px, 100%);
  max-width: min(672px, 100%);
  pointer-events: auto;
  transition: height 350ms var(--ep-spring);
}

/* Moved with `translate` and `scale`, never `transform`: TransitionGroup would take a transform transition for its
   own moves and fight the depth. */
.ep-toast {
  position: relative;
  grid-area: 1 / 1;
  translate: calc(var(--drag-x, 0px) + var(--leave-x, 0px)) calc(var(--y, 0px) + var(--drag-y, 0px) + var(--leave-y, 0px));
  scale: var(--scale, 1);
  transition: translate 350ms var(--ep-spring), scale 350ms var(--ep-spring), height 350ms var(--ep-spring);
}

[data-position='bottom'] .ep-toast {
  align-self: end;
  transform-origin: bottom center;
}

[data-position='top'] .ep-toast {
  align-self: start;
  transform-origin: top center;
}

.ep-toast.is-dragging {
  transition: none;
}

.ep-toast-stack:not(.is-expanded) .ep-toast:not(.is-front) :deep(.ep-toast__body) {
  opacity: 0;
}

/* Coming and going it fades, so for that while it is not glass: a fading element stops the blur behind it. */
.ep-toast-enter-active,
.ep-toast-leave-active,
.ep-toast-fade-enter-active,
.ep-toast-fade-leave-active {
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}

.ep-toast-enter-active {
  transition: translate 400ms var(--ep-spring), scale 400ms var(--ep-spring), opacity 180ms var(--ep-ease-out);
}

.ep-toast-leave-active {
  transition: translate 200ms var(--ep-ease-out), scale 200ms var(--ep-ease-out), opacity 200ms var(--ep-ease-out);
}

.ep-toast-enter-from,
.ep-toast-leave-to {
  opacity: 0;
  scale: calc(var(--scale, 1) - 0.04);
  --leave-y: 20px;
}

[data-position='top'] .ep-toast-enter-from,
[data-position='top'] .ep-toast-leave-to {
  --leave-y: -20px;
}

.ep-toast-leave-to[data-swipe] {
  scale: var(--scale, 1);
  --leave-y: 0px;
}

.ep-toast-leave-to[data-swipe='left'] {
  --leave-x: -110%;
}

.ep-toast-leave-to[data-swipe='right'] {
  --leave-x: 110%;
}

.ep-toast-leave-to[data-swipe='down'] {
  --leave-y: 110%;
}

.ep-toast-leave-to[data-swipe='up'] {
  --leave-y: -110%;
}

.ep-toast-stack.is-reduced-motion .ep-toast,
.ep-toast-stack.is-reduced-motion .ep-toast-stack__list {
  transition: none;
}

.ep-toast-stack.is-reduced-motion .ep-toast.ep-toast-fade-enter-active,
.ep-toast-stack.is-reduced-motion .ep-toast.ep-toast-fade-leave-active {
  transition: opacity 150ms linear;
}

.ep-toast-fade-enter-from,
.ep-toast-fade-leave-to {
  opacity: 0;
}
</style>
