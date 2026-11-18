<script setup lang="ts">
import { IonSkeletonText } from '@ionic/vue';

withDefaults(defineProps<{ label: string; variant?: 'plan' | 'cards' }>(), { variant: 'plan' });

const TABLES = Array.from({ length: 8 }, (_, index) => ({ round: (index + 1) % 3 === 0 }));
const CARDS = 6;
</script>

<template>
  <div
    class="floor-skeleton"
    :class="`floor-skeleton--${variant}`"
    role="progressbar"
    :aria-label="label"
  >
    <div
      v-if="variant === 'cards'"
      class="floor-skeleton__cards"
    >
      <ion-skeleton-text
        v-for="index in CARDS"
        :key="index"
        animated
        class="floor-skeleton__card"
      />
    </div>
    <div
      v-else
      class="floor-skeleton__plan"
    >
      <ion-skeleton-text
        v-for="(block, index) in TABLES"
        :key="index"
        animated
        class="floor-skeleton__table"
        :class="{ 'floor-skeleton__table--round': block.round }"
      />
    </div>
  </div>
</template>

<style scoped>
.floor-skeleton {
  display: flex;
  flex: 1;
  min-height: 0;
}
.floor-skeleton--plan {
  padding: 22px;
}
.floor-skeleton__plan {
  display: grid;
  flex: 1;
  grid-template-columns: repeat(4, 1fr);
  align-items: center;
  gap: 12%;
}
.floor-skeleton__table {
  width: 100%;
  height: auto;
  margin: 0;
  aspect-ratio: 1.25;
  border-radius: 18px;
}
.floor-skeleton__table--round {
  aspect-ratio: 1;
  border-radius: 50%;
}
.floor-skeleton__cards {
  display: grid;
  flex: 1;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: start;
  gap: 9px;
  padding: 2px 1px 12px;
}
.floor-skeleton__card {
  height: 112px;
  margin: 0;
  border-radius: var(--ep-radius-lg);
}
@media (max-width: 640px) {
  .floor-skeleton__table:nth-child(n + 7) {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .floor-skeleton__table,
  .floor-skeleton__card {
    animation: none;
  }
}
</style>
