<script setup lang="ts">
// What sells (prices, changing the plan, paying) is rendered on the web only: on the app surfaces it is
// not even in the DOM, and the `#app` slot takes its place with a sentence, without a link, that says
// how to do it from a browser. For a single element that must stay in the DOM, use `v-web-only`.
import { useSurface } from './surface';

defineSlots<{
  /** Rendered on the web only. */
  default?(): unknown;
  /** Rendered on the app surfaces only, in its place. */
  app?(): unknown;
}>();

const { isWeb } = useSurface();
</script>

<template>
  <slot v-if="isWeb" />
  <slot
    v-else
    name="app"
  />
</template>
