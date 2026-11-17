<script setup lang="ts">
import HubIcon from '../../shell/HubIcon.vue';

withDefaults(
  defineProps<{
    title: string | number;
    icon?: string;
    subtitle?: string | number | null;
    testid?: string;
  }>(),
  { icon: undefined, subtitle: undefined, testid: undefined },
);
</script>

<template>
  <span class="data-table__identity">
    <HubIcon
      v-if="icon"
      class="data-table__identity-icon ep-icon-tile"
      :name="icon"
    />
    <span class="data-table__identity-text">
      <span class="data-table__identity-title">{{ title }}</span>
      <span
        v-if="subtitle !== undefined && subtitle !== null && subtitle !== ''"
        class="data-table__identity-subtitle"
        :data-testid="testid"
      >{{ subtitle }}</span>
    </span>
  </span>
</template>

<style scoped>
.data-table__identity { display: flex; align-items: center; gap: 0.75rem; width: 100%; min-width: 0; }
.data-table__identity-icon { flex: none; width: 44px; height: 44px; color: var(--ep-primary-text); font-size: 22px; }
.data-table__identity-text { display: grid; gap: 2px; min-width: 0; }
.data-table__identity-title { min-width: 0; color: var(--ion-text-color); font-weight: 650; line-height: 1.3; overflow-wrap: break-word; }
.data-table__identity-subtitle { min-width: 0; color: var(--ep-text-muted); font-size: 12px; font-weight: 500; line-height: 1.35; overflow-wrap: break-word; }
</style>
