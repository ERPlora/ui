<script setup lang="ts">
// The label under a table on the plan: its status with its icon and its seats, who holds its reservation and
// from what hour (a long name is cut, the hour never), and why it is greyed out. It never leaves the place
// the table owns on the plan (`--tile-slot`), so it never runs into the next table.
import HubIcon from '../../shell/HubIcon.vue';
import { FLOOR_STATUS_ICONS, type FloorTable } from './model';

defineProps<{ table: FloorTable; inactiveLabel: string }>();
</script>

<template>
  <div class="table-tile__caption">
    <span
      class="table-tile__status"
      data-part="status"
    >
      <HubIcon :name="FLOOR_STATUS_ICONS[table.status]" />
      {{ table.caption }}
    </span>
    <span
      v-if="table.holder"
      class="table-tile__hold"
    >
      <span
        class="table-tile__hold-name"
        data-part="hold-name"
      >{{ table.holder }}</span>
      <span
        v-if="table.holdTime"
        class="table-tile__hold-time"
        data-part="hold-time"
      >· {{ table.holdTime }}</span>
    </span>
    <span
      v-if="inactiveLabel"
      class="table-tile__inactive"
      data-part="inactive"
    >{{ inactiveLabel }}</span>
  </div>
</template>

<style scoped>
.table-tile__caption {
  position: absolute;
  top: calc(100% + 17cqi);
  left: 50%;
  display: flex;
  width: max-content;
  max-width: var(--tile-slot);
  flex-direction: column;
  align-items: center;
  gap: 3px;
  font-size: 12cqi;
  font-weight: 600;
  line-height: 1.25;
  text-align: center;
  transform: translateX(-50%);
  pointer-events: none;
}
.table-tile__status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.25em;
  white-space: nowrap;
}
.table-tile__hold {
  display: flex;
  max-width: 100%;
  min-width: 0;
  color: var(--ep-warning-text);
}
.table-tile__hold-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.table-tile__hold-time {
  flex: none;
  margin-inline-start: 0.3em;
  white-space: nowrap;
}
</style>
