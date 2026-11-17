<script setup lang="ts">
withDefaults(defineProps<{ rows?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 }>(), { rows: 1 });
</script>

<template>
  <div
    class="aligned-card-grid"
    :class="`aligned-card-grid--rows-${rows}`"
  >
    <slot />
  </div>
</template>

<style scoped>
.aligned-card-grid {
  --aligned-card-grid-rows: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  column-gap: 20px;
  row-gap: 12px;
  align-items: stretch;
  inline-size: 100%;
  max-inline-size: 1120px;
  margin-inline: auto;
}
.aligned-card-grid > * {
  min-inline-size: 0;
  grid-row: span var(--aligned-card-grid-rows);
}
.aligned-card-grid--rows-1 { --aligned-card-grid-rows: 1; }
.aligned-card-grid--rows-2 { --aligned-card-grid-rows: 2; }
.aligned-card-grid--rows-3 { --aligned-card-grid-rows: 3; }
.aligned-card-grid--rows-4 { --aligned-card-grid-rows: 4; }
.aligned-card-grid--rows-5 { --aligned-card-grid-rows: 5; }
.aligned-card-grid--rows-6 { --aligned-card-grid-rows: 6; }
.aligned-card-grid--rows-7 { --aligned-card-grid-rows: 7; }
.aligned-card-grid--rows-8 { --aligned-card-grid-rows: 8; }
.aligned-card-grid--rows-9 { --aligned-card-grid-rows: 9; }
.aligned-card-grid--rows-10 { --aligned-card-grid-rows: 10; }
.aligned-card-grid--rows-11 { --aligned-card-grid-rows: 11; }
.aligned-card-grid--rows-12 { --aligned-card-grid-rows: 12; }
@media (min-width: 640px) {
  .aligned-card-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (min-width: 640px) and (max-width: 1099px) {
  .aligned-card-grid:has(> :nth-child(2)) > :last-child:nth-child(odd) {
    grid-column: 1 / -1;
    justify-self: center;
    inline-size: calc((100% - 20px) / 2);
  }
}
@media (min-width: 1100px) {
  .aligned-card-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
/* Children subgrid their own rows. Cards must clip with overflow: clip and provide a stacked fallback without subgrid. */
</style>
