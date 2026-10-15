<script setup lang="ts">
// AppTopbar — the shared topbar of the shell. Ported from ERPlora hub
// `apps/web/src/components/AppTopbar.vue` (origin/develop): the screen title as its heading (with the
// section on screen after it, «Billing · Invoices», mockups README §3), contextual Back and the
// view's own actions. Two navigations (`createShell({ nav })`, shell-config.ts):
// - `menu` (the SaaS): the menu button opens the side menu; Back only on a detail (`backHref`).
// - `launcher` (the hub, PLAN-MIGRATIONS §13, the old hub's shell): no side menu. Back on the left
//   on every screen but Home (also the root of an app), the title in the middle, and on the right
//   the view's actions, the ⠿ «My apps» sheet (AppsLauncher) and the user (avatar → UserMenuPopover).
//   Apps and user are the authenticated chrome: only behind its gate (useChromeVisible, hub#925).
// Not ported (phase 1 has none of them): management link, change hub, assistant, notification bell
// and the progress bar.
import { IonButton, IonButtons, IonHeader, IonMenuButton, IonTitle, IonToolbar } from '@ionic/vue';
import { computed, inject, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { UserAvatar } from '../components/UserAvatar';
import AppsLauncher from './AppsLauncher.vue';
import HubIcon from './HubIcon.vue';
import { SESSION_KEY } from './session';
import { shellNav, useChromeVisible, useShellConfig } from './shell-config';
import UserMenuPopover from './UserMenuPopover.vue';

const props = withDefaults(
  defineProps<{
    /** Title of the view. */
    title: string;
    /** The section on screen (the active tab of the page), said after the title, muted. */
    section?: string;
    /**
     * Fallback href of the Back button. With `nav: 'menu'`, passing it makes the view a detail one
     * and shows Back; with `nav: 'launcher'`, Back is always there off Home and this is where it
     * goes on a deep link (Home when absent).
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
const route = useRoute();
const config = useShellConfig();
const launcher = shellNav(config) === 'launcher';
const chromeVisible = useChromeVisible();
const user = useTopbarUser();

// An empty `backHref` is no `backHref` (as the SaaS always had it): no Back in `menu`, Home in `launcher`.
const showBack = computed(() => (launcher ? route.path !== config.homePath : Boolean(props.backHref)));
const fallback = computed(() => props.backHref || (launcher ? config.homePath : undefined));

const userMenuOpen = shallowRef(false);
const userMenuEvent = shallowRef<Event>();

function goBack(): void {
  // With history inside the app, go back; on a deep link, to the fallback href.
  if (window.history.state?.back) router.back();
  else if (fallback.value) void router.push(fallback.value);
}

function openUserMenu(event: Event): void {
  userMenuEvent.value = event;
  userMenuOpen.value = true;
}

/** The signed-in person, when the shell has a session (the SaaS's topbar may be mounted without). */
function useTopbarUser() {
  const session = inject(SESSION_KEY, null);
  return computed(() => session?.user.value ?? null);
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
          v-if="!launcher"
          class="menu-toggle"
          :auto-hide="false"
          :aria-label="t('topbar.menu')"
        />
        <ion-button
          v-if="showBack"
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
        <template v-if="launcher && chromeVisible && user">
          <AppsLauncher />
          <ion-button
            class="topbar-user"
            data-testid="topbar-user"
            aria-haspopup="dialog"
            :aria-expanded="String(userMenuOpen)"
            :aria-label="t('userMenu.open')"
            @click="openUserMenu"
          >
            <UserAvatar
              :name="user.label"
              :email="user.email"
              size="md"
              decorative
            />
          </ion-button>
          <UserMenuPopover
            class="topbar-user-popover"
            :is-open="userMenuOpen"
            :event="userMenuEvent"
            alignment="end"
            @dismiss="userMenuOpen = false"
          />
        </template>
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
