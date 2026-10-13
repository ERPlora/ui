<script setup lang="ts">
// WebOnly — what sells (the Store, prices, «Change plan», «Pay», «Change card») is rendered on the
// web only (PLAN-SAAS §3.6, point 5; mockups README §4). On the app surfaces (`surface.ts`) it is not
// even in the DOM, and the `#app` slot takes its place: the sentence, WITHOUT a link, that says how
// to do it from a browser («To change your plan or add modules, go to erplora.com in your browser.»).
// For a single element that must stay in the DOM, `v-web-only`.
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
