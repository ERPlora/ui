<script setup lang="ts">
// HomePage — the screen at `/`: the apps of this hub as a grid of cards, Odoo's home convention.
// Everything comes from `base.session.me`, already filtered by permission and translated: one card
// per app that has a menu section (its name, the icon and path of its first entry), so the home
// never offers what the menu does not (on the app surfaces, neither offers a web-only entry). An app
// that is not on yet says so and opens nothing. The hub's only: `createShell({ home: true })`.
import { IonBadge, IonCard } from '@ionic/vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import EmptyState from '../components/EmptyState/EmptyState.vue';
import AppPage from './AppPage.vue';
import HubIcon from './HubIcon.vue';
import { type SessionApp, useSession } from './session';
import { useSurface } from './surface';

interface HomeCard {
  id: string;
  name: string;
  icon: string;
  state: SessionApp['state'];
  /** Where the card goes; none while the app is not on. */
  path?: string;
}

const { t } = useI18n();
const { me, menu } = useSession();
const { isWeb } = useSurface();

/** The menu sends `set:name` of any registered set; a bare name is Ionicons (as in App.vue). */
const iconName = (icon: string): string => (icon.includes(':') ? icon : `ion:${icon}`);

const cards = computed<HomeCard[]>(() =>
  (me.value?.apps ?? []).flatMap((app) => {
    const section = menu.value.find((candidate) => candidate.id === app.label);
    const first = section?.items.find((item) => !item.webOnly || isWeb.value);
    if (!section || !first) return [];
    const path = app.state === 'on' ? first.path : undefined;
    return [{ id: app.label, name: section.label, icon: iconName(first.icon), state: app.state, path }];
  }),
);
</script>

<template>
  <AppPage :title="t('home.title')">
    <EmptyState
      v-if="cards.length === 0"
      icon="apps-outline"
      :heading="t('home.empty.title')"
      :message="t('home.empty.body')"
      data-testid="home-empty"
    />
    <ul
      v-else
      class="home-apps"
    >
      <li
        v-for="card in cards"
        :key="card.id"
      >
        <ion-card
          class="home-app"
          data-testid="home-app"
          :button="card.path !== undefined"
          :router-link="card.path"
          router-direction="root"
        >
          <span class="home-app-tile">
            <HubIcon
              class="home-app-icon"
              :name="card.icon"
            />
          </span>
          <span class="home-app-name">{{ card.name }}</span>
          <ion-badge
            v-if="card.state !== 'on'"
            color="medium"
          >
            {{ t(`home.state.${card.state}`) }}
          </ion-badge>
        </ion-card>
      </li>
    </ul>
  </AppPage>
</template>

<style scoped>
/* Odoo's home: square-ish tiles, as many per row as fit (two on a phone). */
.home-apps {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.home-app {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  height: 100%;
  margin: 0;
  padding: 20px 12px;
  border-radius: var(--ep-radius-lg, 16px);
  box-shadow: var(--ep-shadow-sm, none);
  text-align: center;
}

.home-app::part(native) {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.home-app-tile {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: var(--ep-radius, 12px);
  background: color-mix(in oklab, var(--ion-color-primary) 12%, transparent);
  color: var(--ion-color-primary);
}

.home-app-icon {
  font-size: 28px;
}

.home-app-name {
  font-weight: 600;
  color: var(--ion-text-color);
  overflow-wrap: anywhere;
}
</style>
