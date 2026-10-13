<script setup lang="ts">
// App — root of the shell. Ported from ERPlora hub `apps/web/src/App.vue` (origin/develop): split
// pane, side menu painted from `base.session.me` (with Home first when the shell's Home is on, the
// hub), the user menu under the person at the top (mockups README §3: «usuario arriba, logo abajo»)
// and the router outlet.
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
  IonPopover,
  IonRouterOutlet,
  IonSegment,
  IonSegmentButton,
  IonSplitPane,
  IonToolbar,
} from '@ionic/vue';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import HubIcon from './HubIcon.vue';
import { useSession } from './session';
import { useShellConfig } from './shell-config';
import { useSurface } from './surface';
import { chooseThemeMode, type ThemeMode, themeMode } from './theme';
import { toastError } from './toast';
import { useUserMenu } from './user-menu';

/** Stable id of the main menu, so we never depend on which one Ionic considers "open". */
const SHELL_MENU_ID = 'shell-navigation';

const { user, menu } = useSession();
const { homePath, home } = useShellConfig();
const userMenu = useUserMenu();
const { isWeb } = useSurface();
const { t } = useI18n();
const route = useRoute();
const router = useRouter();

// The one gate of the authenticated chrome (hub#925): it exists where a session is REQUIRED (the
// route's `meta.auth`, the same flag the auth gate reads) and PRESENT. A screen that asks for
// credentials is outside the chrome by construction, and so is one that paints its own frame
// (`meta.chrome: false`, e.g. the SaaS launcher, the auth card of its sign-in).
const showMenu = computed(() => user.value !== null && route.meta.auth === true && route.meta.chrome !== false);

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

/** The menu sends `set:name` of any registered set (HubIcon paints them all); a bare name is Ionicons. */
const iconName = (icon: string): string => (icon.includes(':') ? icon : `ion:${icon}`);

function goHome(): void {
  void router.push(homePath);
}

// ── User menu ──────────────────────────────────────────────────────────────────────────────────
const userMenuOpen = ref(false);
const userMenuEvent = ref<Event | undefined>(undefined);
const userMenuItems = computed(() => (userMenu.items ?? []).filter((item) => !item.webOnly || isWeb.value));
const THEME_CHOICES: Array<{ mode: ThemeMode; icon: string; labelKey: string }> = [
  { mode: 'light', icon: 'ion:sunny-outline', labelKey: 'userMenu.themeLight' },
  { mode: 'dark', icon: 'ion:moon-outline', labelKey: 'userMenu.themeDark' },
  { mode: 'system', icon: 'ion:contrast-outline', labelKey: 'userMenu.themeSystem' },
];

function openUserMenu(event: Event): void {
  userMenuEvent.value = event;
  userMenuOpen.value = true;
}

// A native button should click on Enter/Space, but the webview does not do it consistently, so the
// shell normalizes it (ported from the Hub as is): the click is what opens the menu.
function openUserMenuFromKeyboard(event: KeyboardEvent): void {
  if (event.currentTarget instanceof HTMLButtonElement) event.currentTarget.click();
}

function go(path: string): void {
  userMenuOpen.value = false;
  void router.push(path);
}

function onThemeChange(event: CustomEvent<{ value?: string | number }>): void {
  const mode = THEME_CHOICES.find((choice) => choice.mode === event.detail.value)?.mode;
  if (mode) chooseThemeMode(mode);
}

async function signOut(): Promise<void> {
  userMenuOpen.value = false;
  try {
    await userMenu.logout?.();
  } catch (error) {
    console.error('shell: sign out failed', error);
    void toastError(t('userMenu.logoutFailed'));
  }
}
</script>

<template>
  <ion-app>
    <ion-split-pane
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
            <ion-popover
              class="sidebar-user-popover"
              :is-open="userMenuOpen"
              :event="userMenuEvent"
              side="bottom"
              alignment="start"
              @did-dismiss="userMenuOpen = false"
            >
              <ion-content>
                <ion-list lines="none">
                  <ion-item
                    v-for="item in userMenuItems"
                    :key="item.id"
                    button
                    :detail="false"
                    :data-testid="`user-menu-${item.id}`"
                    @click="go(item.to)"
                  >
                    <HubIcon
                      slot="start"
                      :name="item.icon"
                    />
                    <ion-label>{{ t(item.labelKey) }}</ion-label>
                  </ion-item>
                  <ion-item
                    v-if="userMenu.helpPath"
                    button
                    :detail="false"
                    data-testid="user-menu-help"
                    @click="go(userMenu.helpPath)"
                  >
                    <HubIcon
                      slot="start"
                      name="ion:help-circle-outline"
                    />
                    <ion-label>{{ t('userMenu.help') }}</ion-label>
                  </ion-item>
                  <ion-item
                    class="user-menu-theme"
                    data-testid="user-menu-theme"
                  >
                    <HubIcon
                      slot="start"
                      name="ion:contrast-outline"
                    />
                    <ion-label>{{ t('userMenu.theme') }}</ion-label>
                    <ion-segment
                      slot="end"
                      :value="themeMode"
                      :aria-label="t('userMenu.theme')"
                      @ion-change="onThemeChange"
                    >
                      <ion-segment-button
                        v-for="choice in THEME_CHOICES"
                        :key="choice.mode"
                        :value="choice.mode"
                        :aria-label="t(choice.labelKey)"
                      >
                        <HubIcon :name="choice.icon" />
                      </ion-segment-button>
                    </ion-segment>
                  </ion-item>
                  <ion-item
                    v-if="userMenu.logout"
                    button
                    :detail="false"
                    data-testid="user-menu-logout"
                    @click="signOut"
                  >
                    <HubIcon
                      slot="start"
                      name="ion:log-out-outline"
                    />
                    <ion-label>{{ t('userMenu.logout') }}</ion-label>
                  </ion-item>
                </ion-list>
              </ion-content>
            </ion-popover>
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
