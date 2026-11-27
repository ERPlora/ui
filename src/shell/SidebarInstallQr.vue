<script setup lang="ts">
// Passive on purpose: it asks nothing and has nothing to close, and it is there for everyone, with no role,
// permission or plan. It never takes the room of the menu's entries: on the rail (≥lg, folded from the topbar) the
// menu is 68 px and a readable code needs ~132 px, so its icon stands in for it and opens the menu back up; on a screen
// too low for the entries and the code, the code folds into one row that shows it over the page. polish.css swaps them.
import { IonButton, IonPopover } from '@ionic/vue';
import QRCode from 'qrcode';
import { onMounted, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';

import HubIcon from './HubIcon.vue';
import { INSTALL_QR_OPTIONS, installQrUrl } from './install-qr';
import { railCollapsed } from './sidebar';
import SidebarInstallQrCode from './SidebarInstallQrCode.vue';

const { t } = useI18n();

// Read once: the shell never navigates away from its own hub, so this cannot go stale.
const url = installQrUrl(window.location);
const code = shallowRef<string>();
const failed = shallowRef(false);
const shownOver = shallowRef(false);
const shownBy = shallowRef<Event>();

onMounted(async () => {
  try {
    code.value = await QRCode.toDataURL(url, { ...INSTALL_QR_OPTIONS });
  } catch (error) {
    // Never a blank square: the address a phone can type instead.
    console.error('shell: the install QR could not be drawn', error);
    failed.value = true;
  }
});

function showOver(event: Event): void {
  shownBy.value = event;
  shownOver.value = true;
}
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

    <ion-button
      class="sidebar-install-qr-open"
      data-testid="sidebar-install-qr-open"
      fill="clear"
      size="small"
      aria-haspopup="dialog"
      @click="showOver"
    >
      <HubIcon
        slot="start"
        name="ion:qr-code-outline"
        aria-hidden="true"
      />
      {{ t('installQr.title') }}
    </ion-button>

    <SidebarInstallQrCode
      class="sidebar-install-qr-full"
      :url="url"
      :code="code"
      :failed="failed"
    />

    <ion-popover
      class="sidebar-install-qr-popover"
      :is-open="shownOver"
      :event="shownBy"
      side="top"
      alignment="center"
      @did-dismiss="shownOver = false"
    >
      <SidebarInstallQrCode
        class="sidebar-install-qr-over"
        :url="url"
        :code="code"
        :failed="failed"
      />
    </ion-popover>
  </div>
</template>
