<script setup lang="ts">
// AppTopbar — the shared topbar of the shell. Ported from ERPlora hub
// `apps/web/src/components/AppTopbar.vue` (origin/develop): on the left the menu button (the drawer,
// below lg) and Back only on a detail view (`backHref`), the screen title in the middle as its heading
// (with the section on screen after it, «Billing · Invoices», mockups README §3), and the view's own
// actions on the right. With the hub's sidebar (`createShell({ sidebar })`, PLAN-MIGRATIONS §16, the
// old hub's shell) also the rail toggle after Back (≥lg: folds the pinned menu to its icons) and, after
// the actions, the ⠿ «My apps» sheet (AppsLauncher): the modules are not in the menu. Both are the
// authenticated chrome: only behind its gate (useChromeVisible, hub#925). The person is not here but
// at the top of the side menu (hub#146).
// Not ported (phase 1 has none of them): management link, change hub, assistant, notification bell
// (and the «⋮» that folds them on a phone) and the progress bar.
import { IonButton, IonButtons, IonHeader, IonMenuButton, IonTitle, IonToolbar } from '@ionic/vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import AppsLauncher from './AppsLauncher.vue';
import HubIcon from './HubIcon.vue';
import { useChromeVisible, useShellConfig } from './shell-config';
import { railCollapsed } from './sidebar';

const props = withDefaults(
  defineProps<{
    /** Title of the view. */
    title: string;
    /** The section on screen (the active tab of the page), said after the title, muted. */
    section?: string;
    /**
     * Passing it makes the view a detail one and shows Back; it is where Back goes on a deep link (no
     * history inside the app). A screen of a module (its root) has none, as in the old hub.
     */
    backHref?: string;
    /**
     * Is this title the main HEADING of the screen? (hub#794). `true` by default: a screen opts
     * OUT only when it already paints its own `<h1>`; two level-1 headings is the twin defect.
     */
    titleIsHeading?: boolean;
  }>(),
  { section: undefined, backHref: undefined, titleIsHeading: true },
);

const { t } = useI18n();
const router = useRouter();
const { sidebar } = useShellConfig();
const chromeVisible = useChromeVisible();

/** The hub's chrome of the bar (rail toggle, «My apps»): with its sidebar, behind the gate. */
const hubChrome = computed(() => Boolean(sidebar) && chromeVisible.value);

function goBack(): void {
  // With history inside the app, go back; on a deep link, to `backHref`.
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
        <!-- An empty `backHref` is no `backHref`. -->
        <ion-button
          v-if="backHref"
          fill="clear"
          data-testid="topbar-back"
          :aria-label="t('topbar.back')"
          @click="goBack"
        >
          <HubIcon
            slot="icon-only"
            name="ion:arrow-back-outline"
          />
        </ion-button>
        <!-- The old hub's panel-left, after Back: folds the pinned menu to a rail of icons and opens it
             again. Desktop only (polish.css hides .rail-toggle below lg, where the drawer rules). -->
        <ion-button
          v-if="hubChrome"
          class="rail-toggle"
          fill="clear"
          data-testid="topbar-rail"
          :aria-label="railCollapsed ? t('topbar.expandMenu') : t('topbar.collapseMenu')"
          :aria-expanded="String(!railCollapsed)"
          @click="railCollapsed = !railCollapsed"
        >
          <HubIcon
            slot="icon-only"
            name="lucide:panel-left"
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
        <span
          v-if="section"
          class="topbar-section"
        >{{ section }}</span>
      </ion-title>

      <ion-buttons slot="end">
        <slot name="actions" />
        <AppsLauncher v-if="hubChrome" />
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
