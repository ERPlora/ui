<script setup lang="ts">
// What a deep link to something that sells (`meta.webOnly`) shows inside the native apps: no price and
// no link out, which is what Google Play allows a consumption-only app. The router mounts it keeping
// the address, like the 404.
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
