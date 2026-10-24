<script setup lang="ts">
// App — root of the shell. Ported from ERPlora hub `apps/web/src/App.vue` (origin/develop): the split
// pane (`when="lg"`: a drawer on a phone, pinned from 992 px), the side menu and the router outlet. The
// person at the top opens the user menu (mockups README §3: «usuario arriba, logo abajo»). What the
// menu lists:
// - the SaaS: the sections of `base.session.me` (with Home first when the shell's Home is on);
// - the hub (`createShell({ sidebar })`, PLAN-MIGRATIONS §16): the old hub's — Home and the platform's
//   entries whose screen exists, in groups, and no module (they open from «My apps» and Home); the QR
//   «Open on your phone» in the footer, and the rail the topbar folds it to (sidebar.ts).
// The project's piece of the footer (`createShell({ chrome: { sidebarFooter } })`, the hub's «Upgrade
// plan») goes between the QR and the brand, as in the old hub. Its background piece (`chrome.background`,
// the hub's device notices) is mounted once beside the pane while a person is signed in, keyed on them.
// Not ported (phase 1 has none of them, or they come later): switch user, app update, the version, and
// the overlays mounted next to the pane (assistant, elevation, user switch).
import {
  IonApp,
  IonContent,
  IonFooter,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonMenu,
  IonMenuToggle,
  IonRouterOutlet,
  IonSplitPane,
  IonToolbar,
} from '@ionic/vue';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import HubIcon from './HubIcon.vue';
import { useSession } from './session';
import { useChromeVisible, useShellConfig } from './shell-config';
import { railCollapsed, type ShellSidebarItem, useSidebarGroups } from './sidebar';
import SidebarInstallQr from './SidebarInstallQr.vue';
import { useSurface } from './surface';
import UserMenuPopover from './UserMenuPopover.vue';

/** Stable id of the main menu, so we never depend on which one Ionic considers "open". */
const SHELL_MENU_ID = 'shell-navigation';

const { user, menu } = useSession();
const config = useShellConfig();
const { homePath, home, sidebar, chrome } = config;
const { isWeb } = useSurface();
const { t } = useI18n();
const route = useRoute();
const router = useRouter();

// The one gate of the authenticated chrome (hub#925), shell-config.ts.
const showMenu = useChromeVisible();

// Keyed on the person (hub#2539): the next one gets every screen mounted again, never what was read
// with the session of the one who left. On the split pane and not on the outlet alone: Ionic wires
// `ion-split-pane` and `ion-menu` to their `content-id` once, when they connect.
const screenKey = computed(() => user.value?.id ?? '');

const initials = computed(() => {
  const parts = (user.value?.label ?? '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
});

/** What sells (`webOnly`, the SaaS's Store) is not in the menu on the app surfaces; nor a section left empty. */
const sections = computed(() =>
  menu.value
    .map((section) => ({ ...section, items: section.items.filter((item) => !item.webOnly || isWeb.value) }))
    .filter((section) => section.items.length > 0),
);

const isActive = (path: string): boolean => route.path === path || route.path.startsWith(`${path}/`);

/** «Home» as an entry of the hub's sidebar: the first of its first group. */
const HOME_ITEM: ShellSidebarItem = { id: 'home', labelKey: 'home.title', icon: 'ion:home-outline', to: homePath };

/**
 * The hub's sidebar, as it can be painted: Home first (with the shell's Home on) and only the entries
 * whose screen exists and whose `visible` lets them through, followed live (a setting turned on, the
 * person's permissions).
 */
const platformGroups = sidebar
  ? useSidebarGroups(router, {
      groups: home ? [[HOME_ITEM, ...(sidebar.groups[0] ?? [])], ...sidebar.groups.slice(1)] : sidebar.groups,
    })
  : computed((): ShellSidebarItem[][] => []);

/** The menu sends `set:name` of any registered set (HubIcon paints them all); a bare name is Ionicons. */
const iconName = (icon: string): string => (icon.includes(':') ? icon : `ion:${icon}`);

function goHome(): void {
  void router.push(homePath);
}

// ── User menu (UserMenuPopover.vue) ────────────────────────────────────────────────────────────
const userMenuOpen = ref(false);
const userMenuEvent = ref<Event | undefined>(undefined);

function openUserMenu(event: Event): void {
  // Ionic anchors a popover to `event.target`, the span clicked (name, email or avatar): from the name
  // it covered the card's email line. `ionShadowTarget` is Ionic's own way to name the anchor: the card.
  userMenuEvent.value = new CustomEvent('click', { detail: { ionShadowTarget: event.currentTarget } });
  userMenuOpen.value = true;
}

// A native button should click on Enter/Space, but the webview does not do it consistently, so the
// shell normalizes it (ported from the Hub as is): the click is what opens the menu.
function openUserMenuFromKeyboard(event: KeyboardEvent): void {
  if (event.currentTarget instanceof HTMLButtonElement) event.currentTarget.click();
}
</script>

<template>
  <ion-app>
    <ion-split-pane
      :key="screenKey"
      content-id="main"
      when="lg"
      :class="{ rail: sidebar && railCollapsed }"
    >
      <!-- Side menu: drawer on a phone, pinned from lg. -->
      <ion-menu
        v-if="showMenu"
        :menu-id="SHELL_MENU_ID"
        content-id="main"
        type="overlay"
        class="dash-menu"
      >
        <ion-header class="ion-no-border">
          <ion-toolbar class="brand-toolbar">
            <!-- The person, and the door to their menu (ion-popover: role=dialog). -->
            <button
              type="button"
              class="sidebar-user"
              aria-haspopup="dialog"
              :aria-expanded="userMenuOpen ? 'true' : 'false'"
              :aria-label="t('userMenu.open')"
              data-testid="user-menu-trigger"
              @click="openUserMenu"
              @keydown.enter.prevent="openUserMenuFromKeyboard"
              @keydown.space.prevent="openUserMenuFromKeyboard"
            >
              <span
                class="sidebar-user-avatar"
                aria-hidden="true"
              >{{ initials }}</span>
              <span class="sidebar-user-meta nav-label">
                <span class="sidebar-user-name">{{ user?.label }}</span>
                <span
                  v-if="user?.email"
                  class="sidebar-user-email"
                >{{ user.email }}</span>
              </span>
              <HubIcon
                class="sidebar-user-chevron nav-label"
                name="ion:chevron-expand-outline"
                aria-hidden="true"
              />
            </button>
            <UserMenuPopover
              class="sidebar-user-popover"
              :is-open="userMenuOpen"
              :event="userMenuEvent"
              alignment="start"
              @dismiss="userMenuOpen = false"
            />
          </ion-toolbar>
        </ion-header>

        <!-- The hub's sidebar: its groups, each opened by a divider (the old hub's «General» and
             «Account», without their words): one under the person, one between the two. -->
        <ion-content
          v-if="sidebar"
          class="sidebar-content"
        >
          <ion-list
            v-for="group in platformGroups"
            :key="group[0].id"
            lines="none"
            class="nav-list"
          >
            <ion-list-header
              class="nav-section-label"
              role="separator"
            />
            <ion-menu-toggle
              v-for="item in group"
              :key="item.id"
              :auto-hide="false"
            >
              <ion-item
                button
                class="nav-item"
                :class="{ selected: isActive(item.to) }"
                :router-link="item.to"
                router-direction="root"
                :detail="false"
                :aria-current="isActive(item.to) ? 'page' : undefined"
                :data-testid="`nav-${item.id}`"
              >
                <HubIcon
                  slot="start"
                  class="nav-icon"
                  :name="item.icon"
                />
                <ion-label class="nav-label">
                  {{ t(item.labelKey) }}
                </ion-label>
              </ion-item>
            </ion-menu-toggle>
          </ion-list>
        </ion-content>

        <ion-content
          v-else
          class="sidebar-content"
        >
          <!-- Home first (with the shell's Home on): the way back to the apps grid (HomePage). -->
          <ion-list
            v-if="home"
            lines="none"
            class="nav-list nav-home"
          >
            <ion-menu-toggle :auto-hide="false">
              <ion-item
                button
                class="nav-item"
                :class="{ selected: route.path === homePath }"
                :router-link="homePath"
                router-direction="root"
                :detail="false"
                :aria-current="route.path === homePath ? 'page' : undefined"
                data-testid="nav-home"
              >
                <HubIcon
                  slot="start"
                  class="nav-icon"
                  name="ion:home-outline"
                />
                <ion-label class="nav-label">
                  {{ t('home.title') }}
                </ion-label>
              </ion-item>
            </ion-menu-toggle>
          </ion-list>
          <ion-list
            v-for="section in sections"
            :key="section.id"
            lines="none"
            class="nav-list"
          >
            <ion-list-header
              v-if="section.label"
              class="nav-section-label"
            >
              {{ section.label }}
            </ion-list-header>
            <ion-menu-toggle
              v-for="item in section.items"
              :key="item.path"
              :auto-hide="false"
            >
              <ion-item
                button
                class="nav-item"
                :class="{ selected: isActive(item.path) }"
                :router-link="item.path"
                router-direction="root"
                :detail="false"
                :aria-current="isActive(item.path) ? 'page' : undefined"
              >
                <HubIcon
                  slot="start"
                  class="nav-icon"
                  :name="iconName(item.icon)"
                />
                <ion-label class="nav-label">
                  {{ item.label }}
                </ion-label>
              </ion-item>
            </ion-menu-toggle>
          </ion-list>
        </ion-content>

        <ion-footer class="ion-no-border sidebar-foot">
          <!-- hub#1715: unconditional, and NOT inside an ion-menu-toggle — the code is read by a
               camera, not pressed, and closing the drawer as somebody leans in to scan it is the one
               thing it must not do. -->
          <SidebarInstallQr v-if="sidebar" />
          <div
            v-if="chrome?.sidebarFooter"
            class="sidebar-foot-chrome"
          >
            <component :is="chrome.sidebarFooter" />
          </div>
          <div class="sidebar-foot-brand">
            <ion-menu-toggle :auto-hide="false">
              <a
                class="erp-lockup sm brand-link"
                role="button"
                tabindex="0"
                @click="goHome"
                @keydown.enter="goHome"
              >
                <span class="erp-logo sm">
                  <i class="erp-nw" /><i class="erp-n" /><i class="erp-ne" />
                  <i class="erp-w" /><i class="erp-hub" /><i class="erp-e" />
                  <i class="erp-sw" /><i class="erp-s" /><i class="erp-se" />
                </span>
                <span class="erp-wordmark nav-label">erplora</span>
              </a>
            </ion-menu-toggle>
          </div>
        </ion-footer>
      </ion-menu>

      <ion-router-outlet id="main" />
    </ion-split-pane>
    <component
      :is="chrome.background"
      v-if="chrome?.background && user"
      :key="screenKey"
    />
  </ion-app>
</template>
