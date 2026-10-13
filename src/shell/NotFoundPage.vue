<script setup lang="ts">
// NotFoundPage — the screen of an address this hub does not have (hub#1723). Ported from ERPlora
// hub `apps/web/src/views/NotFoundPage.vue` + `components/NotFoundState.vue` (origin/develop), in
// one file for phase 1. A redirect would be silent (it rewrites the address bar and destroys the
// evidence that the link was wrong), so the router's catch-all mounts this instead: it says so and
// offers ONE way out, Home, painted inside the shell's layout so the menu stays at hand.
import { IonButton } from '@ionic/vue';
import { useI18n } from 'vue-i18n';

import EmptyState from '../components/EmptyState/EmptyState.vue';
import AppPage from './AppPage.vue';
import { useShellConfig } from './shell-config';

const { t } = useI18n();
const { homePath } = useShellConfig();
</script>

<template>
  <AppPage
    :title="t('notFound.title')"
    content-layout="detail"
  >
    <EmptyState
      icon="help-circle-outline"
      :heading="t('notFound.title')"
      :message="t('notFound.body')"
      data-testid="not-found"
    >
      <template #action>
        <ion-button
          :router-link="homePath"
          data-testid="not-found-home"
        >
          {{ t('notFound.action') }}
        </ion-button>
      </template>
    </EmptyState>
  </AppPage>
</template>
