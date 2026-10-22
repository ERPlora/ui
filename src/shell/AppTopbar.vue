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
// On a phone (≤767 px) two or more actions of the view fold into «⋮» («More actions»), which lists
// them in a popover: three text actions left the title as «Flo…» at 390 (hub#111). One action, or a
// wider window, keeps them in the bar. Material's top app bar, Apple's navigation bars and Polaris'
// page header roll them up the same way.
// The project's piece of the bar (`createShell({ chrome: { topbar } })`, the hub's bell) closes the end
// group, after «My apps» as in the old hub, behind the same gate.
// Not ported (phase 1 has none of them): management link, change hub, assistant and the progress bar.
import { IonButton, IonButtons, IonHeader, IonMenuButton, IonPopover, IonTitle, IonToolbar } from '@ionic/vue';
import { Comment, computed, Fragment, onBeforeUnmount, ref, Text, useSlots, type VNode } from 'vue';
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
const { sidebar, chrome } = useShellConfig();
const chromeVisible = useChromeVisible();

/** The hub's chrome of the bar (rail toggle, «My apps»): with its sidebar, behind the gate. */
const hubChrome = computed(() => Boolean(sidebar) && chromeVisible.value);

/** The window width at or below which the view's actions fold into «⋮». */
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
const foldActions = (): boolean => phone.value && countNodes(slots.actions?.() ?? []) > 1;

const moreOpen = ref(false);
const moreEvent = ref<Event>();
function openMore(event: Event): void {
  moreEvent.value = event;
  moreOpen.value = true;
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
        <template v-if="foldActions()">
          <ion-button
            fill="clear"
            data-testid="topbar-more"
            aria-haspopup="true"
            :aria-expanded="String(moreOpen)"
            :aria-label="t('topbar.moreActions')"
            @click="openMore"
          >
            <HubIcon
              slot="icon-only"
              name="ion:ellipsis-vertical"
            />
          </ion-button>
          <ion-popover
            :is-open="moreOpen"
            :event="moreEvent"
            @did-dismiss="moreOpen = false"
          >
            <!-- A button group, as in the bar, so Ionic paints them clear: a menu, not solid blocks.
                 Choosing an action runs it (its own click) and closes the list. -->
            <ion-buttons
              class="topbar-more"
              data-testid="topbar-more-menu"
              @click="moreOpen = false"
            >
              <slot name="actions" />
            </ion-buttons>
          </ion-popover>
        </template>
        <slot
          v-else
          name="actions"
        />
        <AppsLauncher v-if="hubChrome" />
        <component
          :is="chrome.topbar"
          v-if="chrome?.topbar && chromeVisible"
        />
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

/* On a phone the three equal thirds left the title 127 px between two groups of two icons (hub#111):
   there each group takes only what its buttons need, both at least two buttons wide so the title
   stays centred, and the title takes the rest — about what Ionic's own ios bar gives it. */
@media (max-width: 767px) {
  .app-topbar ion-toolbar.ios > ion-buttons {
    flex: 0 0 auto;
    min-width: 5.5rem;
  }
}

/* The folded actions, one per row, as a menu: each one as wide as the list, its label at the start
   (Material's menu and iOS's menus lead with the label). Ionic centres the label inside `.button-inner`,
   which spans the whole button and is out of reach (`native` is the only part): as a grid that does
   not stretch its track, `native` sizes that inner box to its label and places it at the start. */
.topbar-more {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding-block: 4px;
}

.topbar-more :deep(ion-button) {
  margin: 0;
  --border-radius: 0;
}

.topbar-more :deep(ion-button)::part(native) {
  display: grid;
  justify-content: start;
}
</style>
