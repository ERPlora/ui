<script setup lang="ts">
import { IonSpinner, IonToggle } from '@ionic/vue';
import { computed, nextTick, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    /** The real state: what the switch shows unless a change asked for is on its way. */
    checked: boolean;
    /** Its accessible name, which says what flipping it does. */
    label: string;
    disabled?: boolean;
    /** A change on its way: the switch waits beside a spinner. */
    busy?: boolean;
    /** What the spinner says to assistive technology. */
    busyLabel?: string;
  }>(),
  { disabled: false, busy: false, busyLabel: undefined },
);

const emit = defineEmits<{ change: [checked: boolean] }>();

const toggle = ref<{ $el: HTMLElement & { checked: boolean } }>();
/** Where the person put it, while the change they asked for is on its way. */
const requested = ref<boolean>();
const shown = computed(() => requested.value ?? props.checked);

/** Ionic keeps the position a tap gave it: put it back when the switch must show something else. */
function sync(): void {
  const el = toggle.value?.$el;
  if (el && el.checked !== shown.value) el.checked = shown.value;
}

function onChange(event: CustomEvent<{ checked: boolean }>): void {
  requested.value = event.detail.checked;
  emit('change', event.detail.checked);
  // A change the parent did not start (a question cancelled, a refusal) never shows as done.
  void nextTick(() => {
    if (!props.busy) requested.value = undefined;
    sync();
  });
}

watch(
  () => props.checked,
  () => {
    requested.value = undefined;
  },
);
watch(
  () => props.busy,
  (now, before) => {
    if (before && !now) requested.value = undefined;
  },
);
watch(shown, sync, { flush: 'post' });
</script>

<template>
  <span
    class="data-table__toggle"
    @click.stop
  >
    <ion-toggle
      ref="toggle"
      :checked="shown"
      :disabled="disabled || busy"
      :aria-label="label"
      @ion-change="onChange"
    />
    <ion-spinner
      v-if="busy"
      name="dots"
      role="status"
      :aria-label="busyLabel ?? label"
    />
  </span>
</template>

<style scoped>
.data-table__toggle { display: inline-flex; flex: none; align-items: center; gap: 0.375rem; min-height: 44px; }
.data-table__toggle ion-toggle { flex: none; min-height: 44px; margin: 0; }
.data-table__toggle ion-spinner { flex: none; width: 20px; height: 20px; color: var(--ep-primary-text); }
</style>
