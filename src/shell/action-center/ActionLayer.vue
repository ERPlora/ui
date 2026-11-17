<script setup lang="ts">
import { onBeforeUnmount } from 'vue';

import ActionArrival from './ActionArrival.vue';
import ActionPanel from './ActionPanel.vue';
import { connectActionCenter } from './center';
import type { ActionNoticeSource } from './types';

const props = defineProps<{ actionNotices: () => ActionNoticeSource }>();
const disconnect = connectActionCenter(props.actionNotices());
onBeforeUnmount(disconnect);
</script>

<template>
  <ActionArrival />
  <ActionPanel />
</template>
