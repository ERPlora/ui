<script setup lang="ts">
// Pressed while open with `aria-pressed`, because `ion-button` follows no `aria-expanded` once painted. Shown only to a
// person the host lets use the assistant (`AssistantConfig.canUse`; whoever is signed in when it says nothing).
import { IonButton } from '@ionic/vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import HubIcon from '../../shell/HubIcon.vue';
import { useSession } from '../../shell/session';
import { assistantConfig } from './config';
import { useAssistant } from './state';

const { t } = useI18n({ useScope: 'global' });
const session = useSession();
const assistant = useAssistant();
const { canUse } = assistantConfig();
const allowed = computed(() => (canUse ? canUse(session) : true));
</script>

<template>
  <ion-button
    v-if="allowed"
    class="assistant-button"
    data-testid="assistant-button"
    :aria-label="t('assistant.open')"
    :title="t('assistant.open')"
    :aria-pressed="assistant.state.open ? 'true' : 'false'"
    :color="assistant.state.open ? 'primary' : undefined"
    @click="assistant.toggle()"
  >
    <HubIcon
      slot="icon-only"
      name="ion:sparkles-outline"
    />
  </ion-button>
</template>
