<script setup lang="ts">
import { IonInfiniteScroll, IonInfiniteScrollContent } from '@ionic/vue';
import { nextTick, onMounted, ref, watch } from 'vue';

const props = defineProps<{
  /** Every row is on screen: Ionic stops listening. */
  disabled: boolean;
  /** The rows on screen: other rows (more, or another search's) mean the load asked for has arrived. */
  shown: readonly unknown[];
  /** The last load failed: the table says so, and the end may ask again. */
  failed: boolean;
  /** The table is loading: rows that change meanwhile are not yet the answer. */
  waiting: boolean;
  /** What the indicator says while the next rows load, also read aloud. */
  label: string;
}>();

const emit = defineEmits<{ more: [] }>();

/** How close to the end, in px, the next rows are asked for. */
const THRESHOLD = 120;
const scroller = ref<{ $el: HTMLElement & { complete?: () => Promise<void> } }>();
const pending = ref(false);
/** How many rows there were when more were last asked for: an answer that adds none is not asked for again by itself. */
let askedWith = -1;

function askForMore(): void {
  if (pending.value || props.disabled) return;
  pending.value = true;
  askedWith = props.shown.length;
  emit('more');
}

/** Ionic reached the end: ask for more, or, when nothing can be asked for now, give Ionic its end back at once (it never
 *  asks again until its last request is completed). A load already on its way completes it when it arrives. */
function onInfinite(): void {
  if (pending.value) return;
  if (props.disabled) void scroller.value?.$el.complete?.();
  else askForMore();
}

/** Ionic's own scroll host: the `ion-content` around the table, or the table's own scroller. */
async function scrollHost(): Promise<HTMLElement | null> {
  const host = scroller.value?.$el.closest<HTMLElement>('ion-content, .ion-content-scroll-host') ?? null;
  if (host?.tagName !== 'ION-CONTENT') return host;
  return (host as HTMLElement & { getScrollElement: () => Promise<HTMLElement> }).getScrollElement();
}

/** Ionic only asks on a scroll: rows that leave the end in view would never get the next ones. Measured on the next
 *  frame, once the new rows are laid out, and never again after an answer that added no row. */
function fillTheHost(): void {
  requestAnimationFrame(async () => {
    const host = await scrollHost();
    if (!host || !(host.clientHeight > 0) || props.shown.length <= askedWith) return;
    if (host.scrollHeight - host.scrollTop - host.clientHeight <= THRESHOLD) askForMore();
  });
}

watch(
  () => [props.shown, props.failed, props.disabled, props.waiting],
  async () => {
    if (pending.value) {
      if (props.waiting && !props.failed && !props.disabled) return;
      pending.value = false;
      await scroller.value?.$el.complete?.();
    }
    if (!props.failed) fillTheHost();
  },
);
onMounted(() => void nextTick(fillTheHost));
</script>

<template>
  <ion-infinite-scroll
    ref="scroller"
    class="data-table__infinite"
    :threshold="`${THRESHOLD}px`"
    :disabled="disabled"
    @ion-infinite="onInfinite"
  >
    <ion-infinite-scroll-content
      loading-spinner="crescent"
      :loading-text="label"
    />
  </ion-infinite-scroll>
  <span
    class="data-table__infinite-status"
    role="status"
    aria-live="polite"
  >{{ pending ? label : '' }}</span>
</template>

<style scoped>
.data-table__infinite { grid-column: 1 / -1; }
.data-table__infinite-status { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
</style>
