<script setup lang="ts">
import { IonInfiniteScroll, IonInfiniteScrollContent } from '@ionic/vue';
import { nextTick, onMounted, ref, watch } from 'vue';

const props = defineProps<{
  /** Every row is on screen: Ionic stops listening. */
  disabled: boolean;
  /** Rows on screen: when it changes, the load asked for has arrived. */
  shown: number;
  /** The last load failed: the table says so, and the end may ask again. */
  failed: boolean;
  /** What the indicator says while the next rows load, also read aloud. */
  label: string;
}>();

const emit = defineEmits<{ more: [] }>();

/** How close to the end, in px, the next rows are asked for. */
const THRESHOLD = 120;
const scroller = ref<{ $el: HTMLElement & { complete?: () => Promise<void> } }>();
const pending = ref(false);

function askForMore(): void {
  if (pending.value || props.disabled) return;
  pending.value = true;
  emit('more');
}

/** Ionic's own scroll host: the `ion-content` around the table, or the table's own scroller. */
async function scrollHost(): Promise<HTMLElement | null> {
  const host = scroller.value?.$el.closest<HTMLElement>('ion-content, .ion-content-scroll-host') ?? null;
  if (host?.tagName !== 'ION-CONTENT') return host;
  return (host as HTMLElement & { getScrollElement: () => Promise<HTMLElement> }).getScrollElement();
}

/** Ionic only asks on a scroll: rows that leave the end in view would never get the next ones. */
async function fillTheHost(): Promise<void> {
  await nextTick();
  const host = await scrollHost();
  if (!host || !(host.clientHeight > 0)) return;
  if (host.scrollHeight - host.scrollTop - host.clientHeight <= THRESHOLD) askForMore();
}

watch(
  () => [props.shown, props.failed, props.disabled],
  async () => {
    if (!pending.value) return;
    pending.value = false;
    await scroller.value?.$el.complete?.();
    if (!props.failed) await fillTheHost();
  },
);
onMounted(fillTheHost);
</script>

<template>
  <ion-infinite-scroll
    ref="scroller"
    class="data-table__infinite"
    :threshold="`${THRESHOLD}px`"
    :disabled="disabled"
    @ion-infinite="askForMore"
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
