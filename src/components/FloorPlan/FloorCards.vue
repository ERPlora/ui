<script setup lang="ts">
// A zone on a phone: a card per table, by number, two to a row.
import { computed } from 'vue';

import FloorCard from './FloorCard.vue';
import type { FloorTable } from './model';

const props = defineProps<{ tables: FloorTable[]; label: string }>();
const emit = defineEmits<{ select: [id: string] }>();

const byNumber = new Intl.Collator(undefined, { numeric: true });
const sorted = computed(() => [...props.tables].sort((a, b) => byNumber.compare(a.number, b.number)));
</script>

<template>
  <div
    class="floor-cards"
    role="list"
    :aria-label="label"
  >
    <div
      v-for="table in sorted"
      :key="table.id"
      class="floor-cards__item"
      role="listitem"
    >
      <FloorCard
        :table="table"
        @select="(id: string) => emit('select', id)"
      />
    </div>
  </div>
</template>

<style scoped>
.floor-cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
  padding: 2px 1px 12px;
}
.floor-cards__item {
  display: flex;
  min-width: 0;
  flex-direction: column;
  animation: floor-cards-enter 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes floor-cards-enter {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.985);
  }
}
@media (prefers-reduced-motion: reduce) {
  .floor-cards__item {
    animation: none;
  }
}
</style>
