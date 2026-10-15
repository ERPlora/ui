<script setup lang="ts">
// AppsLauncher — the topbar's door to the apps (`nav: 'launcher'`, the old hub's ⠿): a button that
// opens the «My apps» sheet, one tile per app of `useMyApps` (the same list as the Home grid). A
// tile opens its app and closes the sheet; an app that is not on yet says so and opens nothing.
// The app's page is a lazy chunk: when it fails to load (a flaky network, hub#2489 / hub#2325) the
// launcher tries once more and, if it still fails, says which app with a Retry; never silent.
import {
  IonButton,
  IonButtons,
  IonHeader,
  IonModal,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import { computed, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import EmptyState from '../components/EmptyState/EmptyState.vue';
import HubIcon from './HubIcon.vue';
import { type MyApp, useMyApps } from './my-apps';
import { useSession } from './session';
import { toast } from './toast';

const { t } = useI18n();
const router = useRouter();
const { me, status } = useSession();
const apps = useMyApps();

const isOpen = shallowRef(false);
const view = computed<'apps' | 'empty' | 'loading' | 'error'>(() => {
  if (me.value) return apps.value.length > 0 ? 'apps' : 'empty';
  return status.value === 'error' ? 'error' : 'loading';
});

const stateText = (app: MyApp): string | undefined =>
  app.state === 'on' ? undefined : t(`home.state.${app.state}`);
const tileLabel = (app: MyApp): string => [app.name, stateText(app)].filter(Boolean).join(', ');

async function open(app: MyApp): Promise<void> {
  const path = app.path;
  if (!path) return;
  isOpen.value = false;
  try {
    await router.push(path);
  } catch {
    try {
      await router.push(path);
    } catch (error) {
      console.error(`shell: could not open the app ${app.id}`, error);
      void toast(t('launcher.openFailed', { app: app.name }), 'danger', 0, 'apps-launcher-open', {
        text: t('launcher.retry'),
        // The browser keeps a failed dynamic import failed for the life of the document, so a Retry
        // inside the SPA fails again: load the app's page afresh (Vite's advice for a lost chunk).
        handler: () => window.location.assign(router.resolve(path).href),
      });
    }
  }
}
</script>

<template>
  <ion-button
    data-testid="topbar-apps"
    :aria-label="t('launcher.title')"
    aria-haspopup="dialog"
    :aria-expanded="String(isOpen)"
    @click="isOpen = true"
  >
    <HubIcon
      slot="icon-only"
      name="ion:apps-outline"
      aria-hidden="true"
    />
  </ion-button>
  <ion-modal
    data-testid="apps-launcher"
    class="apps-launcher-sheet"
    :is-open="isOpen"
    :initial-breakpoint="1"
    :breakpoints="[0, 1]"
    @did-dismiss="isOpen = false"
  >
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>{{ t('launcher.title') }}</ion-title>
        <ion-buttons slot="end">
          <ion-button
            data-testid="apps-launcher-close"
            :aria-label="t('launcher.close')"
            @click="isOpen = false"
          >
            <HubIcon
              slot="icon-only"
              name="ion:close"
              aria-hidden="true"
            />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <div class="apps-launcher-body">
      <ul
        v-if="view === 'apps'"
        class="apps-launcher-grid"
      >
        <li
          v-for="app in apps"
          :key="app.id"
        >
          <button
            type="button"
            class="apps-launcher-app"
            data-testid="apps-launcher-app"
            :title="app.name"
            :aria-label="tileLabel(app)"
            :disabled="!app.path"
            @click="open(app)"
          >
            <span class="apps-launcher-tile">
              <HubIcon
                :name="app.icon"
                aria-hidden="true"
              />
            </span>
            <span class="apps-launcher-name">{{ app.name }}</span>
            <span
              v-if="stateText(app)"
              class="apps-launcher-state"
            >{{ stateText(app) }}</span>
          </button>
        </li>
      </ul>
      <EmptyState
        v-else-if="view === 'empty'"
        icon="apps-outline"
        :heading="t('home.empty.title')"
        :message="t('home.empty.body')"
        data-testid="apps-launcher-empty"
      />
      <p
        v-else-if="view === 'error'"
        class="apps-launcher-message"
        role="alert"
        data-testid="apps-launcher-error"
      >
        {{ t('launcher.error') }}
      </p>
      <p
        v-else
        class="apps-launcher-message"
        role="status"
        data-testid="apps-launcher-loading"
      >
        <ion-spinner
          name="crescent"
          aria-hidden="true"
        />
        {{ t('launcher.loading') }}
      </p>
    </div>
  </ion-modal>
</template>

<style scoped>
/* Ionic's auto-height sheet: as tall as its tiles, scrolling past 80% of the screen. Ionic Vue wraps
   the content in a `.ion-page` of its own (no scope attribute): reached with :deep. */
.apps-launcher-sheet {
  --height: auto;
}

.apps-launcher-sheet :deep(.ion-page) {
  position: relative;
  display: block;
  contain: content;
}

.apps-launcher-body {
  max-height: 80vh;
  overflow: auto;
  padding: 4px 12px calc(16px + var(--ion-safe-area-bottom, 0px));
}

/* The old hub's «My apps»: a filled tile with the icon, the name under it, three per row on a phone. */
.apps-launcher-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.apps-launcher-app {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 44px;
  padding: 10px 4px;
  border: 0;
  border-radius: var(--ep-radius, 12px);
  background: transparent;
  color: var(--ion-text-color);
  font: inherit;
  cursor: pointer;
}

.apps-launcher-app:hover:not(:disabled) {
  background: color-mix(in oklab, var(--ion-text-color) 6%, transparent);
}

.apps-launcher-app:focus-visible {
  outline: 2px solid var(--ion-color-primary);
  outline-offset: 2px;
}

.apps-launcher-app:disabled {
  cursor: default;
  opacity: 0.6;
}

.apps-launcher-tile {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  font-size: 26px;
}

/* A long name is cut at two lines; the whole of it is the tile's title and accessible name (hub#1106). */
.apps-launcher-name {
  display: -webkit-box;
  max-width: 100%;
  overflow: hidden;
  font-size: 0.8125rem;
  line-height: 1.25;
  text-align: center;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.apps-launcher-state {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
}

.apps-launcher-message {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 24px 0;
  color: var(--ion-color-medium);
  text-align: center;
}
</style>
