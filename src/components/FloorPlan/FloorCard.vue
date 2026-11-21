<script setup lang="ts">
import { IonCard } from '@ionic/vue';
import { computed, onMounted, useTemplateRef, watch } from 'vue';

import { occupiedAmount, type FloorTable } from './model';
import TableGlyph from './TableGlyph.vue';

const props = defineProps<{ table: FloorTable }>();
const emit = defineEmits<{ select: [id: string] }>();

const amount = computed(() => occupiedAmount(props.table));
const card = useTemplateRef<{ $el: HTMLElement }>('card');

// ion-card hands an `aria-label` to the button it draws only once, when it loads, and none of the other ARIA:
// the name changes with the minutes and the dimmed state comes and goes, so both are kept in step here.
async function syncNative(): Promise<void> {
  await customElements.whenDefined('ion-card');
  const host = card.value?.$el as (HTMLElement & { componentOnReady?: () => Promise<unknown> }) | undefined;
  await host?.componentOnReady?.();
  const native = host?.shadowRoot?.querySelector('button');
  if (!native) return;
  native.setAttribute('aria-label', props.table.accessible);
  if (props.table.pickable === false) native.setAttribute('aria-disabled', 'true');
  else native.removeAttribute('aria-disabled');
}
onMounted(syncNative);
watch(() => [props.table.accessible, props.table.pickable], syncNative, { flush: 'post' });

function onClick(): void {
  if (props.table.pickable !== false) emit('select', props.table.id);
}
</script>

<template>
  <ion-card
    ref="card"
    button
    class="floor-card ep-surface ion-focusable"
    :class="{ 'floor-card--dimmed': table.pickable === false, 'floor-card--target': table.pickable === true }"
    :data-status="table.status"
    :data-shape="table.shape"
    :data-testid="table.testid"
    @click="onClick"
  >
    <span class="floor-card__layout">
      <span
        class="floor-card__media"
        aria-hidden="true"
      >
        <TableGlyph
          :table="table"
          variant="mini"
        />
      </span>
      <span class="floor-card__content">
        <span
          class="floor-card__number"
          data-part="number"
        >{{ table.number }}</span>
        <span
          class="floor-card__meta"
          data-part="meta"
        >{{ table.holder || table.pax }}<span
          v-if="table.holder && table.holdTime"
          class="floor-card__hold-time"
          data-part="hold-time"
        >{{ ` · ${table.holdTime}` }}</span></span>
      </span>
      <span class="floor-card__status">
        <span data-part="status">{{ table.statusLabel }}</span>
        <span
          v-if="table.timed"
          class="floor-card__time"
          :data-tone="table.tone"
          data-part="time"
        >{{ table.short }}</span>
        <span
          v-if="amount"
          class="floor-card__amount"
          data-part="amount"
        >{{ amount }}</span>
      </span>
    </span>
  </ion-card>
</template>

<style scoped>
.floor-card {
  --card-accent: var(--ep-text-muted);
  --card-edge: var(--ion-border-color);
  height: 100%;
  min-height: 112px;
  margin: 0;
  border: 2px solid var(--card-edge);
  border-radius: var(--ep-radius-lg);
  box-shadow: var(--ep-shadow-sm);
  color: var(--ion-text-color);
  text-align: start;
  transition: border-color 420ms, box-shadow 180ms, opacity 250ms;
}
.floor-card::part(native) {
  height: 100%;
}
.floor-card[data-status='available'] {
  --card-accent: var(--ep-success-text);
  --card-edge: color-mix(in srgb, var(--ion-color-success) 36%, var(--ion-border-color));
}
.floor-card[data-status='occupied'] {
  --card-accent: var(--ep-primary-text);
  --card-edge: color-mix(in srgb, var(--ion-color-primary) 36%, var(--ion-border-color));
}
.floor-card[data-status='reserved'] {
  --card-accent: var(--ep-warning-text);
  --card-edge: color-mix(in srgb, var(--ion-color-warning) 58%, var(--ion-border-color));
  border-style: dashed;
}
.floor-card[data-status='blocked'] {
  --card-edge: var(--ion-color-medium-shade);
}
.floor-card.ion-focused {
  outline: 2px solid var(--ep-primary-text);
  outline-offset: 3px;
  box-shadow: var(--ep-focus-ring);
}
.floor-card--dimmed {
  opacity: 0.4;
  cursor: not-allowed;
}
.floor-card--target {
  outline: 2px solid var(--ep-primary-text);
  outline-offset: 3px;
}
.floor-card__layout {
  display: grid;
  height: 100%;
  box-sizing: border-box;
  grid-template-areas: 'media content' 'media status';
  grid-template-columns: auto minmax(0, 1fr);
  align-content: center;
  gap: 2px 8px;
  padding: 10px;
}
.floor-card__media {
  position: relative;
  display: block;
  width: 50px;
  height: 50px;
  grid-area: media;
  align-self: center;
}
.floor-card[data-shape='rectangle'] .floor-card__media {
  width: 56px;
  height: 38px;
}
.floor-card__content {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  grid-area: content;
  align-self: end;
}
.floor-card__number {
  color: var(--card-accent);
  font-size: 26px;
  font-weight: 750;
  letter-spacing: -0.045em;
  line-height: 1;
}
.floor-card__meta {
  max-width: 100%;
  color: var(--ep-text-muted);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
  overflow-wrap: break-word;
}
.floor-card__status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 3px;
  grid-area: status;
  align-self: start;
  color: var(--card-accent);
  font-size: 11px;
  font-weight: 750;
  line-height: 1.2;
}
.floor-card__time {
  padding: 2px 5px;
  border-radius: 7px;
  background: var(--ep-primary-tint);
  color: var(--ep-primary-text);
  font-size: 10px;
}
.floor-card__amount {
  color: var(--ion-text-color);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.floor-card__time[data-tone='warning'] {
  background: var(--ep-warning-tint);
  color: var(--ep-warning-text);
}
.floor-card__time[data-tone='critical'] {
  background: var(--ep-danger-tint);
  color: var(--ep-danger-text);
}
@media (prefers-reduced-motion: reduce) {
  .floor-card {
    transition: none;
  }
}
</style>
