<script setup lang="ts">
// UserMenuPopover — the user menu (mockups README §3; PLAN-SAAS §3.6, point 1): an ion-popover
// (role=dialog) with the project's entries, Help, the theme (light, dark, system) and Sign out, under
// the person's card at the top of the side menu (App.vue; in the hub too, hub#146: never an avatar in
// the topbar). The parent owns whether it is open; picking an entry, signing out or Ionic dismissing it
// (backdrop, Escape) emits `dismiss`.
import { IonContent, IonItem, IonLabel, IonList, IonPopover, IonSegment, IonSegmentButton } from '@ionic/vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import HubIcon from './HubIcon.vue';
import { openExternalLink } from './open-external';
import { useSurface } from './surface';
import { chooseThemeMode, type ThemeMode, themeMode } from './theme';
import { toastError } from './toast';
import { type ShellUserMenuItem, useUserMenu } from './user-menu';

withDefaults(
  defineProps<{
    isOpen: boolean;
    /** The click that opened it: Ionic anchors the popover to its target. */
    event?: Event;
    /** Edge of the trigger it lines up with: `start` under the sidebar card, `end` under the avatar. */
    alignment?: 'start' | 'end';
  }>(),
  { event: undefined, alignment: 'start' },
);

const emit = defineEmits<{ dismiss: [] }>();

const userMenu = useUserMenu();
const { isWeb } = useSurface();
const { t } = useI18n();
const router = useRouter();

const items = computed(() => (userMenu.items ?? []).filter((item) => !item.webOnly || isWeb.value));
const THEME_CHOICES: Array<{ mode: ThemeMode; icon: string; labelKey: string }> = [
  { mode: 'light', icon: 'ion:sunny-outline', labelKey: 'userMenu.themeLight' },
  { mode: 'dark', icon: 'ion:moon-outline', labelKey: 'userMenu.themeDark' },
  { mode: 'system', icon: 'ion:contrast-outline', labelKey: 'userMenu.themeSystem' },
];

function go(path: string): void {
  emit('dismiss');
  void router.push(path);
}

/**
 * An entry of this app opens its route; one outside it is a link the browser opens in a new tab, and the installed
 * app in the system browser (`openExternalLink`); an action runs once the menu is asked to close, so what it opens
 * (a dialog) never sits under the popover.
 */
function pick(item: ShellUserMenuItem, event: Event): void {
  if (item.to !== undefined) {
    go(item.to);
    return;
  }
  emit('dismiss');
  if (item.run !== undefined) {
    item.run();
    return;
  }
  openExternalLink(item.href, event);
}

function onThemeChange(event: CustomEvent<{ value?: string | number }>): void {
  const mode = THEME_CHOICES.find((choice) => choice.mode === event.detail.value)?.mode;
  if (mode) chooseThemeMode(mode);
}

async function signOut(): Promise<void> {
  emit('dismiss');
  try {
    await userMenu.logout?.();
  } catch (error) {
    console.error('shell: sign out failed', error);
    void toastError(t('userMenu.logoutFailed'));
  }
}
</script>

<template>
  <ion-popover
    :is-open="isOpen"
    :event="event"
    side="bottom"
    :alignment="alignment"
    @did-dismiss="emit('dismiss')"
  >
    <ion-content>
      <ion-list lines="none">
        <ion-item
          v-for="item in items"
          :key="item.id"
          button
          :detail="false"
          :data-testid="`user-menu-${item.id}`"
          :href="item.href"
          :target="item.href ? '_blank' : undefined"
          :rel="item.href ? 'noopener' : undefined"
          @click="pick(item, $event)"
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
</template>
