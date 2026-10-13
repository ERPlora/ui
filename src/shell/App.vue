<script setup lang="ts">
// App — root of the shell. Ported from ERPlora hub `apps/web/src/App.vue` (origin/develop),
// phase-1 minimum: split pane, side menu painted from `base.session.me` and the router outlet.
// Not ported (phase 1 has none of them, or they come later): the user menu popover (profile, switch
// user, sign out), app update / install QR / upgrade plan in the footer, the version, the rail
// toggle, and the overlays mounted next to the pane (assistant, elevation, user switch).
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
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import HubIcon from './HubIcon.vue';
import { useSession } from './session';
import { useShellConfig } from './shell-config';

/** Stable id of the main menu, so we never depend on which one Ionic considers "open". */
const SHELL_MENU_ID = 'shell-navigation';

const { user, menu } = useSession();
const { homePath } = useShellConfig();
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

const isActive = (path: string): boolean => route.path === path || route.path.startsWith(`${path}/`);

/** The menu sends `set:name` of any registered set (HubIcon paints them all); a bare name is Ionicons. */
const iconName = (icon: string): string => (icon.includes(':') ? icon : `ion:${icon}`);

function goHome(): void {
  void router.push(homePath);
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
            <div class="sidebar-user">
              <div class="sidebar-user-avatar">
                <span>{{ initials }}</span>
              </div>
              <div class="sidebar-user-meta nav-label">
                <div class="sidebar-user-name">
                  {{ user?.label }}
                </div>
              </div>
            </div>
          </ion-toolbar>
        </ion-header>

        <ion-content class="sidebar-content">
          <ion-list
            v-for="section in menu"
            :key="section.id"
            lines="none"
            class="nav-list"
          >
            <ion-list-header class="nav-section-label">
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
