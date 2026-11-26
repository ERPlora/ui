<script setup lang="ts">
import { IonLabel, IonSegment, IonSegmentButton } from '@ionic/vue';
import { computed, useTemplateRef } from 'vue';

import { type FloorZoneTab, zoneColor } from './model';
import { useScrollEdges } from './useScrollEdges';

defineProps<{ zones: FloorZoneTab[]; active: string | null; label: string }>();
const emit = defineEmits<{ change: [zoneId: string] }>();

function onChange(event: CustomEvent<{ value?: string | number }>): void {
  const value = event.detail.value;
  if (value !== undefined && value !== null) emit('change', String(value));
}

const strip = useTemplateRef<InstanceType<typeof IonSegment>>('strip');
const { edges } = useScrollEdges(computed(() => (strip.value?.$el as HTMLElement | undefined) ?? null));
</script>

<template>
  <ion-segment
    ref="strip"
    class="floor-zone-tabs"
    :class="{ 'floor-zone-tabs--more-left': edges.left, 'floor-zone-tabs--more-right': edges.right }"
    scrollable
    :value="active ?? undefined"
    :aria-label="label"
    @ion-change="onChange"
  >
    <ion-segment-button
      v-for="zone in zones"
      :key="zone.id"
      :value="zone.id"
      :data-testid="zone.testid"
    >
      <ion-label>
        <span
          class="zone-tab"
          :style="{ '--zone-color': zoneColor(zone.color) }"
        >
          <span
            class="zone-tab__dot"
            aria-hidden="true"
          />
          <span data-part="zone-name">{{ zone.name }}</span>
          <span
            class="zone-tab__count"
            data-part="zone-count"
            aria-hidden="true"
          >{{ zone.occupied }}/{{ zone.total }}</span>
          <span
            class="zone-tab__said"
            data-part="zone-count-said"
          >{{ zone.said }}</span>
        </span>
      </ion-label>
    </ion-segment-button>
  </ion-segment>
</template>

<style scoped>
.floor-zone-tabs {
  flex: 1 1 auto;
  min-width: 0;
}
.floor-zone-tabs ion-segment-button {
  min-width: 112px;
}
.floor-zone-tabs--more-right {
  -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 1.5rem), transparent);
  mask-image: linear-gradient(to right, #000 calc(100% - 1.5rem), transparent);
}
.floor-zone-tabs--more-left {
  -webkit-mask-image: linear-gradient(to left, #000 calc(100% - 1.5rem), transparent);
  mask-image: linear-gradient(to left, #000 calc(100% - 1.5rem), transparent);
}
.floor-zone-tabs--more-left.floor-zone-tabs--more-right {
  -webkit-mask-image: linear-gradient(to right, transparent, #000 1.5rem, #000 calc(100% - 1.5rem), transparent);
  mask-image: linear-gradient(to right, transparent, #000 1.5rem, #000 calc(100% - 1.5rem), transparent);
}
.zone-tab {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
}
.zone-tab__dot {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--zone-color);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--zone-color) 12%, transparent);
}
.zone-tab__count {
  color: var(--ep-text-muted);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  font-weight: 650;
}
.zone-tab__said {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
