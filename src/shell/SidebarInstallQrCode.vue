<script setup lang="ts">
// The face of «Open on your phone»: the code, or the address to type when it could not be drawn, over its title and
// hint. SidebarInstallQr draws the code once and paints this face in the foot or, folded, over the page.
import { useI18n } from 'vue-i18n';

defineProps<{
  url: string;
  /** The code as a PNG data URL, once drawn. */
  code?: string;
  failed: boolean;
}>();

const { t } = useI18n();
</script>

<template>
  <div>
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
</template>
