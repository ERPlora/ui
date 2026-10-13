<script setup lang="ts">
// AppTopbar — the shared topbar of the shell. Ported from ERPlora hub
// `apps/web/src/components/AppTopbar.vue` (origin/develop), phase-1 minimum: menu button, contextual
// back, the screen title as its heading and the view's own actions. Not ported (phase 1 has none
// of them): app launcher, management link, change hub, assistant, notification bell, rail toggle
// and the progress bar.
import { IonButton, IonButtons, IonHeader, IonIcon, IonMenuButton, IonTitle, IonToolbar } from '@ionic/vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

const props = withDefaults(
  defineProps<{
    /** Title of the view. */
    title: string;
    /** Fallback href of the Back button. When passed, the view is a detail one and shows Back. */
    backHref?: string;
    /**
     * Is this title the main HEADING of the screen? (hub#794). `true` by default: a screen opts
     * OUT only when it already paints its own `<h1>`; two level-1 headings is the twin defect.
     */
    titleIsHeading?: boolean;
  }>(),
  { backHref: undefined, titleIsHeading: true },
);

const { t } = useI18n();
const router = useRouter();

function goBack(): void {
  // With history inside the app, go back; on a deep link, to the fallback href.
  if (window.history.state?.back) router.back();
  else if (props.backHref) void router.push(props.backHref);
}
</script>

<template>
  <ion-header class="ion-no-border app-topbar">
    <ion-toolbar>
      <ion-buttons slot="start">
        <!-- hub#1831: `auto-hide` off — Ionic hides the button until its `ion-menu` registers, which
             happens after the screen is painted, so a phone showed the page with no way out of it.
             Hiding it where the menu is pinned (≥lg) is the stylesheet's job: `polish.css`. -->
        <ion-menu-button
          class="menu-toggle"
          :auto-hide="false"
          :aria-label="t('topbar.menu')"
        />
        <ion-button
          v-if="backHref"
          fill="clear"
          data-testid="topbar-back"
          :aria-label="t('topbar.back')"
          @click="goBack"
        >
          <ion-icon
            slot="icon-only"
            name="arrow-back-outline"
          />
        </ion-button>
      </ion-buttons>

      <!-- The name of the screen, and its HEADING (hub#794): `role`/`aria-level` on the host rather
           than a separate `<h1>`, so the ear reads exactly what the eye reads. -->
      <ion-title
        :role="titleIsHeading ? 'heading' : undefined"
        :aria-level="titleIsHeading ? '1' : undefined"
      >
        {{ title }}
      </ion-title>

      <ion-buttons slot="end">
        <slot name="actions" />
      </ion-buttons>
    </ion-toolbar>
  </ion-header>
</template>

<style scoped>
/* A long title never covers the buttons (PoC issue C: at 390 px it ran over the menu button and
   «Mark done»/«Delete»). In ios Ionic lays the title `position: absolute` across the WHOLE toolbar
   and keeps it off the buttons with `padding: 0 90px`, which Tailwind's preflight wipes (and 90px
   would not clear two actions anyway). So, as for sheets (global.css), the title goes back into
   the toolbar's row, between the button groups, where its own `.toolbar-title` cuts it with «…».
   Both groups take the same share of the row (never less than their buttons need), so the title
   stays centred on the bar, as Ionic and the Hub of today paint it, whenever it fits. */
.app-topbar ion-toolbar.ios > ion-buttons {
  flex: 1 1 0;
  min-width: max-content;
}

.app-topbar ion-toolbar.ios > ion-buttons[slot='end'] {
  justify-content: flex-end;
}

.app-topbar ion-title.ios {
  position: relative;
  padding-inline: 4px;
}
</style>
