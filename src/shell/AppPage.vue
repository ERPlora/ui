<script setup lang="ts">
// AppPage — the ONE layout of the shell screens (ADR-0045). Ported from ERPlora hub
// `apps/web/src/components/AppPage.vue` (origin/develop): `ion-page` + `AppTopbar` + a single
// `ion-content`, so every view shares the same container, padding and margins and only injects its
// content. Phase-1 minimum: the strips over the content (setup blocking strip, offline strip) and
// the footer tabbar wiring (`bindTabbar`, hub#1734/#1830) are not ported.
//
// Slots: default (the view, inside `ion-content`), `actions` (forwarded to the topbar), `footer`
// (after the content: a sheet's action bar or a tabbar).
import { IonContent, IonPage } from '@ionic/vue';

import AppTopbar from './AppTopbar.vue';

withDefaults(
  defineProps<{
    /** Title of the view (to AppTopbar), and its level-1 heading unless `headingOnScreen`. */
    title: string;
    /** Fallback href of Back; when passed the topbar shows Back (detail view). */
    backHref?: string;
    /** Inner width: fluid for data/tables; `detail`/`detail-fill` for reading, forms and settings. */
    contentLayout?: 'fluid' | 'detail' | 'detail-fill';
    /** The view already paints its own `<h1>` (hub#794): the toolbar title drops the heading role. */
    headingOnScreen?: boolean;
  }>(),
  { backHref: undefined, contentLayout: 'fluid', headingOnScreen: false },
);
</script>

<template>
  <ion-page>
    <AppTopbar
      :title="title"
      :back-href="backHref"
      :title-is-heading="!headingOnScreen"
    >
      <template
        v-if="$slots.actions"
        #actions
      >
        <slot name="actions" />
      </template>
    </AppTopbar>

    <!-- fullscreen=false: the ion-content sits STRICTLY between the topbar and the footer (it does not
         scroll behind them). The shell's rounded content card (polish.css) needs it: with fullscreen
         its two top corners hid behind the opaque topbar. -->
    <ion-content
      :fullscreen="false"
      class="ion-padding"
    >
      <div
        v-if="contentLayout !== 'fluid'"
        class="hub-detail-shell"
        :class="{ 'hub-detail-shell--fill': contentLayout === 'detail-fill' }"
      >
        <slot />
      </div>
      <slot v-else />
    </ion-content>

    <slot name="footer" />
  </ion-page>
</template>
