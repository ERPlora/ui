<script setup lang="ts">
// With the hub's sidebar the bar also carries the rail toggle and «My apps» (the modules are not in the
// menu); both, and the project's piece of the bar (`chrome.topbar`), are authenticated chrome, only
// behind its gate (useChromeVisible).
// On a phone (≤767 px) the end of the bar holds two buttons, the bell always one of them: when the view's actions,
// «My apps» and the project's piece do not fit beside it, or the view brings two or more actions (three text actions
// leave the title as «Flo…» at 390 px), they all go into one «⋮» («More actions»). Material's top app bar, Apple's
// navigation bars and Polaris' page header roll them up the same way.
import { IonButton, IonButtons, IonHeader, IonMenuButton, IonTitle, IonToolbar } from '@ionic/vue';
import { Comment, computed, Fragment, onBeforeUnmount, ref, Text, useSlots, type VNode } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import ActionBell from './action-center/ActionBell.vue';
import AppsLauncher from './AppsLauncher.vue';
import HubIcon from './HubIcon.vue';
import { useChromeVisible, useShellConfig } from './shell-config';
import { railCollapsed } from './sidebar';
import TopbarMore from './TopbarMore.vue';

const props = withDefaults(
  defineProps<{
    /** Title of the view. */
    title: string;
    /** The section on screen (the active tab of the page), said after the title, muted. */
    section?: string;
    /**
     * Passing it makes the view a detail one and shows Back; it is where Back goes on a deep link (no
     * history inside the app). A screen of a module (its root) has none.
     */
    backHref?: string;
    /**
     * Is this title the main heading of the screen? `true` by default: a screen opts
     * OUT only when it already paints its own `<h1>`; two level-1 headings is the twin defect.
     */
    titleIsHeading?: boolean;
  }>(),
  { section: undefined, backHref: undefined, titleIsHeading: true },
);

const { t } = useI18n();
const router = useRouter();
const { sidebar, chrome, actionNotices } = useShellConfig();
const chromeVisible = useChromeVisible();

/** The hub's chrome of the bar (rail toggle, «My apps»): with its sidebar, behind the gate. */
const hubChrome = computed(() => Boolean(sidebar) && chromeVisible.value);
/** The project's piece of the bar (the assistant), behind the same gate. */
const piece = computed(() => (chromeVisible.value ? chrome?.topbar : undefined));
const bell = computed(() => Boolean(actionNotices) && chromeVisible.value);
const appsOpen = ref(false);

/** The window width at or below which the end of the bar folds into «⋮». */
const PHONE_QUERY = '(max-width: 767px)';
const phone = ref(false);
const phoneQuery = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(PHONE_QUERY) : null;
const onPhoneChange = (event: { matches: boolean }) => (phone.value = event.matches);
if (phoneQuery) {
  phone.value = phoneQuery.matches;
  phoneQuery.addEventListener('change', onPhoneChange);
}
onBeforeUnmount(() => phoneQuery?.removeEventListener('change', onPhoneChange));

const slots = useSlots();
/** How many actions the view puts in the bar: its rendered nodes, without what a `v-if` left out. */
function countNodes(nodes: VNode[]): number {
  return nodes.reduce((count, node) => {
    if (node.type === Fragment) return count + countNodes(node.children as VNode[]);
    if (node.type === Comment || (node.type === Text && !String(node.children).trim())) return count;
    return count + 1;
  }, 0);
}
/** Called while rendering, so it follows what the view's slot shows. */
function folded(): boolean {
  if (!phone.value) return false;
  const actions = countNodes(slots.actions?.() ?? []);
  const others = [hubChrome.value, piece.value, bell.value].filter(Boolean).length;
  return actions > 1 || actions + others > 2;
}

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
        <!-- Seen only where the shell has its side menu (the same gate): elsewhere it opened nothing. Shown and
             hidden, never added or removed: the bar keeps its children while a session comes or goes. `auto-hide`
             off: Ionic hides the button until its `ion-menu` registers, which happens after the screen is
             painted, so a phone showed the page with no way out of it. Hiding it where the menu is pinned (≥lg)
             is the stylesheet's job: `polish.css`. -->
        <ion-menu-button
          v-show="chromeVisible"
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
        <!-- After Back: folds the pinned menu to a rail of icons and opens it
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

      <!-- The name of the screen, and its heading: `role`/`aria-level` on the host rather
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
        <TopbarMore
          v-if="folded()"
          v-slot="{ closeThen }"
        >
          <slot name="actions" />
          <ion-button
            v-if="hubChrome"
            data-testid="topbar-more-apps"
            @click="closeThen(() => (appsOpen = true))"
          >
            <HubIcon
              slot="start"
              name="ion:apps-outline"
            />
            {{ t('launcher.title') }}
          </ion-button>
          <component
            :is="piece"
            v-if="piece"
          />
        </TopbarMore>
        <slot
          v-else
          name="actions"
        />
        <!-- Its sheet stays in the bar when «My apps» is a row of «⋮»: the menu's content goes when the menu closes. -->
        <AppsLauncher
          v-if="hubChrome"
          v-model:open="appsOpen"
          :show-button="!folded()"
        />
        <component
          :is="piece"
          v-if="piece && !folded()"
        />
        <ActionBell v-if="bell" />
      </ion-buttons>
    </ion-toolbar>
  </ion-header>
</template>

<style scoped>
/* A long title never covers the buttons. In ios Ionic lays the title `position: absolute` across the WHOLE toolbar
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

/* On a phone the three equal thirds left the title 127 px. There the title's box takes what its text needs and the
   two groups share the rest alike: centred while it fits, whatever each group holds (the bell grows into a pill),
   and a longer one takes all the room the buttons leave, cut with «…» only past it, as iOS's navigation bar does. */
@media (max-width: 767px) {
  .app-topbar ion-toolbar.ios::part(content) {
    flex: 0 1 auto;
  }
}
</style>
