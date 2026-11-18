<script setup lang="ts">
// A table on the floor plan, at its box: its number and one line inside (the time occupied, the hour of its
// reservation or its status), its seats and its arc around it, and its label under it. The plan around it owns
// the pointer and the keys; this only paints.
import { computed } from 'vue';

import FloorTileCaption from './FloorTileCaption.vue';
import type { FloorBox, FloorTable } from './model';
import TableGlyph from './TableGlyph.vue';

const props = withDefaults(
  defineProps<{
    table: FloorTable;
    box: FloorBox;
    /** Shown under a table that is out of service, greyed out; empty for one in service. */
    inactiveLabel?: string;
    /** The plan is being edited: the table is grabbed to move it. */
    editing?: boolean;
    dragging?: boolean;
  }>(),
  { inactiveLabel: '', editing: false, dragging: false },
);

const classes = computed(() => ({
  'table-tile': true,
  'table-tile--round': props.table.shape === 'round',
  'table-tile--rectangle': props.table.shape === 'rectangle',
  'table-tile--inactive': !!props.inactiveLabel,
  'table-tile--editing': props.editing,
  'table-tile--dragging': props.dragging,
  'table-tile--dimmed': props.table.pickable === false,
  'table-tile--target': props.table.pickable === true,
}));
const style = computed(() => ({
  left: `${props.box.x}px`,
  top: `${props.box.y}px`,
  width: `${props.box.width}px`,
  height: `${props.box.height}px`,
  '--tile-slot': `${props.box.slot}px`,
}));
const unreachable = computed(() => props.table.pickable === false);
</script>

<template>
  <div
    :class="classes"
    :style="style"
    :data-status="table.status"
    :data-timer="table.tone"
    :data-testid="table.testid"
  >
    <TableGlyph :table="table" />
    <button
      class="table-tile__button"
      type="button"
      :aria-label="table.accessible"
      :aria-disabled="unreachable ? 'true' : undefined"
      :tabindex="unreachable ? -1 : 0"
      :disabled="unreachable"
      :title="table.accessible"
    >
      <span
        class="table-tile__number"
        data-part="number"
      >{{ table.number }}</span>
      <span
        class="table-tile__line"
        :data-tone="table.tone"
        data-part="line"
      >{{ table.short }}</span>
    </button>
    <FloorTileCaption
      :table="table"
      :inactive-label="inactiveLabel"
    />
  </div>
</template>

<style scoped src="./floor-status.css"></style>

<style scoped>
.table-tile {
  --tile-shadow: 0 8px 24px color-mix(in srgb, var(--ion-text-color) 11%, transparent);
  position: absolute;
  container-type: inline-size;
  user-select: none;
  animation: table-tile-enter 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
.table-tile[data-status='occupied'] {
  --tile-shadow: 0 12px 30px color-mix(in srgb, var(--table-bg) 30%, transparent);
}
.table-tile__button {
  position: relative;
  z-index: 2;
  display: flex;
  width: 100%;
  height: 100%;
  min-width: var(--ep-touch-min);
  min-height: var(--ep-touch-min);
  box-sizing: border-box;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5cqi;
  padding: 8cqi;
  border: 1px solid var(--table-edge);
  border-radius: var(--ep-radius-lg);
  background: var(--table-bg);
  box-shadow: var(--tile-shadow);
  color: var(--table-ink);
  font: inherit;
  cursor: pointer;
  transition: background-color 420ms, color 420ms, border-color 420ms, opacity 250ms, scale 180ms;
  touch-action: manipulation;
}
.table-tile--round .table-tile__button {
  border-radius: 50%;
}
.table-tile[data-status='reserved'] .table-tile__button {
  border-width: 2px;
  border-style: dashed;
}
.table-tile[data-status='blocked'] .table-tile__button {
  background: repeating-linear-gradient(135deg, var(--ion-card-background), var(--ion-card-background) 8px, color-mix(in srgb, var(--ion-color-medium) 12%, var(--ion-card-background)) 8px, color-mix(in srgb, var(--ion-color-medium) 12%, var(--ion-card-background)) 12px);
}
.table-tile__button:hover {
  scale: 1.025;
}
.table-tile__button:focus-visible {
  outline: 2px solid var(--ep-primary-text);
  outline-offset: 3px;
  box-shadow: var(--ep-focus-ring);
}
.table-tile__number {
  font-size: 32cqi;
  font-weight: 750;
  line-height: 1;
  letter-spacing: -0.045em;
}
.table-tile__line {
  max-width: 100%;
  padding: 0.2em 0.45em;
  border-radius: 0.6em;
  font-size: 12cqi;
  font-weight: 750;
  line-height: 1.2;
  white-space: nowrap;
}
.table-tile[data-status='occupied'] .table-tile__line[data-tone='warning'] {
  background: var(--ep-warning-tint);
  color: var(--ep-warning-text);
}
.table-tile[data-status='occupied'] .table-tile__line[data-tone='critical'] {
  background: var(--ep-danger-tint);
  color: var(--ep-danger-text);
}
.table-tile--inactive,
.table-tile--dimmed {
  opacity: 0.4;
}
.table-tile--dimmed .table-tile__button {
  cursor: not-allowed;
}
.table-tile--editing .table-tile__button {
  cursor: grab;
  touch-action: none;
}
.table-tile--target .table-tile__button {
  outline: 2px solid var(--ep-primary-text);
  outline-offset: 5px;
  animation: table-tile-target 1.8s ease-in-out infinite;
}
.table-tile--dragging {
  z-index: 10;
}
.table-tile--dragging .table-tile__button {
  cursor: grabbing;
  scale: 1.04;
}
@keyframes table-tile-enter {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.985);
  }
}
@keyframes table-tile-target {
  50% {
    box-shadow: 0 0 0 8px transparent;
  }
}
@media (prefers-reduced-motion: reduce) {
  .table-tile,
  .table-tile__button,
  .table-tile--target .table-tile__button {
    animation: none;
    transition: none;
  }
  .table-tile__button:hover,
  .table-tile--dragging .table-tile__button {
    scale: 1;
  }
}
</style>
