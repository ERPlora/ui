<script setup lang="ts">
// NotInAppPage — what a deep link to something that sells (the Store, `meta.webOnly`) shows inside
// the apps (PLAN-SAAS §3.6, point 5; mockups README §4): a neutral screen, with no price and no link
// out (what Google Play admits of a consumption-only app), inside the shell layout and with ONE way
// out, Home. The router mounts it keeping the address, like the 404 (router.ts).
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
    :title="t('notInApp.title')"
    content-layout="detail"
  >
    <EmptyState
      icon="globe-outline"
      :heading="t('notInApp.title')"
      :message="t('notInApp.body')"
      data-testid="not-in-app"
    >
      <template #action>
        <ion-button
          :router-link="homePath"
          data-testid="not-in-app-home"
        >
          {{ t('notInApp.action') }}
        </ion-button>
      </template>
    </EmptyState>
  </AppPage>
</template>
