<script setup lang="ts">
// SidebarInstallQr — hub#1715, the door from this counter to somebody's phone: in the footer of the
// hub's side menu (`createShell({ sidebar })`), a QR of this hub with «Open on your phone» and how to
// keep it. Passive on purpose (hub#685): it asks nothing, covers nothing and has nothing to close, and
// it is there for everyone — no role, no permission, no plan.
//
// On the rail (≥lg, folded from the topbar) the menu is 68 px and a readable code needs ~132 px, so its
// icon stands in for it (polish.css swaps them) and opens the menu back up, where the code fits.
import { IonButton } from '@ionic/vue';
import QRCode from 'qrcode';
import { onMounted, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';

import HubIcon from './HubIcon.vue';
import { INSTALL_QR_OPTIONS, installQrUrl } from './install-qr';
import { railCollapsed } from './sidebar';

const { t } = useI18n();

// Read once: the shell never navigates away from its own hub, so this cannot go stale.
const url = installQrUrl(window.location);
const code = shallowRef<string>();
const failed = shallowRef(false);

onMounted(async () => {
  try {
    code.value = await QRCode.toDataURL(url, { ...INSTALL_QR_OPTIONS });
  } catch (error) {
    // Never a blank square: the address a phone can type instead.
    console.error('shell: the install QR could not be drawn', error);
    failed.value = true;
  }
});
</script>

<template>
  <div
    class="sidebar-install-qr"
    data-testid="sidebar-install-qr"
  >
    <ion-button
      class="sidebar-install-qr-rail"
      fill="clear"
      size="small"
      :title="t('installQr.title')"
      :aria-label="t('installQr.title')"
      @click="railCollapsed = false"
    >
      <HubIcon
        slot="icon-only"
        name="ion:qr-code-outline"
        aria-hidden="true"
      />
    </ion-button>

    <div class="sidebar-install-qr-full">
      <img
        v-if="code"
        class="sidebar-install-qr-code"
        :src="code"
        width="132"
        height="132"
        :alt="t('installQr.alt', { url })"
      >
      <p
        v-else-if="failed"
        class="sidebar-install-qr-url"
      >
        {{ url }}
      </p>
      <span
        v-else
        class="sidebar-install-qr-code sidebar-install-qr-pending"
        aria-hidden="true"
      />
      <p class="sidebar-install-qr-title">
        {{ t('installQr.title') }}
      </p>
      <!-- One sentence for both platforms: the screen painting the code cannot know what phone will
           read it, and both «install» paths live in the browser's menu. -->
      <p class="sidebar-install-qr-hint">
        {{ t('installQr.hint') }}
      </p>
    </div>
  </div>
</template>
