<script setup lang="ts">
// App — root of the shell. Ported from ERPlora hub `apps/web/src/App.vue` (origin/develop).
// Two navigations (`createShell({ nav })`, shell-config.ts):
// - `menu` (the SaaS): split pane, side menu painted from `base.session.me` (with Home first when the
//   shell's Home is on), the user menu under the person at the top (mockups README §3: «usuario
//   arriba, logo abajo») and the router outlet.
// - `launcher` (the hub, PLAN-MIGRATIONS §13): the router outlet alone, at every width. Back, the apps
//   («My apps») and the user menu live in the topbar of every screen (AppTopbar.vue).
// Not ported (phase 1 has none of them, or they come later): switch user, app update / install QR /
// upgrade plan in the footer, the version, the rail toggle, and the overlays mounted next to the
// pane (assistant, elevation, user switch).
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
import { shellNav, useChromeVisible, useShellConfig } from './shell-config';
import { useSurface } from './surface';
import UserMenuPopover from './UserMenuPopover.vue';

/** Stable id of the main menu, so we never depend on which one Ionic considers "open". */
const SHELL_MENU_ID = 'shell-navigation';

const { user, menu } = useSession();
const config = useShellConfig();
const { homePath, home } = config;
const launcher = shellNav(config) === 'launcher';
const { isWeb } = useSurface();
const { t } = useI18n();
const route = useRoute();
const router = useRouter();

// The one gate of the authenticated chrome (hub#925), shell-config.ts.
const showMenu = useChromeVisible();

// Keyed on the person (hub#2539): the next one gets every screen mounted again, never what was read
// with the session of the one who left. On the split pane and not on the outlet alone: Ionic wires
// `ion-split-pane` and `ion-menu` to their `content-id` once, when they connect. With the launcher
// there is no pane: the key goes on the outlet.
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

/** The menu sends `set:name` of any registered set (HubIcon paints them all); a bare name is Ionicons. */
const iconName = (icon: string): string => (icon.includes(':') ? icon : `ion:${icon}`);

function goHome(): void {
  void router.push(homePath);
}

// ── User menu (UserMenuPopover.vue) ────────────────────────────────────────────────────────────
const userMenuOpen = ref(false);
const userMenuEvent = ref<Event | undefined>(undefined);

function openUserMenu(event: Event): void {
  userMenuEvent.value = event;
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
    <!-- Launcher (the hub): no side menu at any width; the topbar carries the navigation. -->
    <ion-router-outlet
      v-if="launcher"
      id="main"
      :key="screenKey"
    />
    <ion-split-pane
      v-else
      :key="screenKey"
      content-id="main"
      when="lg"
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

        <ion-content class="sidebar-content">
          <!-- Home first (the hub): the way back to the apps grid (HomePage) from any screen. -->
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
  </ion-app>
</template>
