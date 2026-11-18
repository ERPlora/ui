<script setup lang="ts">
// The bar's «⋮» on a phone: what does not fit beside the bell is listed in its popover, one row each. The rows see
// the menu (useTopbarMenu) and paint themselves as rows with their label.
import { IonButton, IonButtons, IonPopover } from '@ionic/vue';
import { provide, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import HubIcon from './HubIcon.vue';
import { TOPBAR_MENU_KEY } from './topbar-menu';

const { t } = useI18n();
const open = ref(false);
const anchor = ref<Event>();
let afterClose: (() => void) | undefined;

function show(event: Event): void {
  anchor.value = event;
  open.value = true;
}

function closeThen(action: () => void): void {
  afterClose = action;
  open.value = false;
}

function onDismissed(): void {
  open.value = false;
  const action = afterClose;
  afterClose = undefined;
  action?.();
}

provide(TOPBAR_MENU_KEY, { closeThen });
</script>

<template>
  <ion-button
    fill="clear"
    data-testid="topbar-more"
    aria-haspopup="true"
    :aria-expanded="String(open)"
    :aria-label="t('topbar.moreActions')"
    @click="show"
  >
    <HubIcon
      slot="icon-only"
      name="ion:ellipsis-vertical"
    />
  </ion-button>
  <ion-popover
    :is-open="open"
    :event="anchor"
    @did-dismiss="onDismissed"
  >
    <!-- A button group, as in the bar, so Ionic paints them clear: a menu, not solid blocks.
         Choosing a row runs it (its own click) and closes the list. -->
    <ion-buttons
      class="topbar-more"
      data-testid="topbar-more-menu"
      @click="open = false"
    >
      <slot :close-then="closeThen" />
    </ion-buttons>
  </ion-popover>
</template>

<style scoped>
/* One row per entry, each one as wide as the list, its label at the start (Material's menu and iOS's menus lead with
   the label). Ionic centres the label inside `.button-inner`, which spans the whole button and is out of reach
   (`native` is the only part): as a grid that does not stretch its track, `native` sizes that inner box to its label
   and places it at the start. */
.topbar-more {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding-block: 4px;
}

.topbar-more :deep(ion-button) {
  margin: 0;
  --border-radius: 0;
}

.topbar-more :deep(ion-button)::part(native) {
  display: grid;
  justify-content: start;
}
</style>
