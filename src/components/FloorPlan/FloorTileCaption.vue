<script setup lang="ts">
import { computed } from 'vue';

import HubIcon from '../../shell/HubIcon.vue';
import { FLOOR_STATUS_ICONS, occupiedAmount, type FloorTable } from './model';

const props = defineProps<{ table: FloorTable; inactiveLabel: string }>();
const amount = computed(() => occupiedAmount(props.table));
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
      v-if="amount || table.holder"
      class="table-tile__detail"
    >
      <span
        v-if="amount"
        class="table-tile__amount"
        data-part="amount"
      >{{ amount }}</span>
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
/* A bill and a later reservation share one line: a third would reach the table drawn under this one. */
.table-tile__detail {
  display: flex;
  max-width: 100%;
  min-width: 0;
}
.table-tile__amount {
  flex: none;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.table-tile__hold {
  display: flex;
  max-width: 100%;
  min-width: 0;
  color: var(--ep-warning-text);
}
.table-tile__amount + .table-tile__hold::before {
  flex: none;
  margin-inline: 0.3em;
  content: '·';
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
