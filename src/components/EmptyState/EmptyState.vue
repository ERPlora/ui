<script setup lang="ts">
// The default slot adds content after the message; the `action` slot sits under the text (typically an ion-button).
import { IonIcon } from '@ionic/vue';
import { computed } from 'vue';

import { ionIconSrc } from '../../shell/icons';

const props = withDefaults(
  defineProps<{
    /** Icon (`ion:` by default, any baked set, or inline SVG). */
    icon?: string;
    heading?: string;
    message?: string;
  }>(),
  { icon: 'file-tray-outline', heading: undefined, message: undefined },
);

const iconSrc = computed(() => ionIconSrc(props.icon));
</script>

<template>
  <div class="empty-state">
    <div class="wrap">
      <ion-icon
        :icon="iconSrc"
        aria-hidden="true"
      />
      <h2
        v-if="heading"
        class="heading"
      >
        {{ heading }}
      </h2>
      <p
        v-if="message"
        class="message"
      >
        {{ message }}
      </p>
      <slot />
      <div class="action">
        <slot name="action" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.empty-state {
  display: block;
  width: 100%;
  /* Overridable tokens (Ionic style): --ep-* → --ion-* → hex. */
  --icon-color: var(--ep-color-medium, var(--ion-color-medium, #92949c));
  --heading-color: var(--ep-text-color, var(--ion-text-color, #1f2933));
  --message-color: var(--ep-color-medium, var(--ion-color-medium, #92949c));
  --icon-size: 64px;
  --padding: 2.5rem 1.25rem;
}

.wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 0.5rem;
  padding: var(--padding);
  box-sizing: border-box;
  width: 100%;
}

ion-icon {
  font-size: var(--icon-size);
  color: var(--icon-color);
  opacity: 0.5;
  margin-bottom: 0.25rem;
}

.heading {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--heading-color);
  /* The heading inherits the line height and spacing of its context, not the shell's global h2 type. */
  line-height: inherit;
  letter-spacing: inherit;
}

.message {
  margin: 0;
  font-size: 0.9375rem;
  color: var(--message-color);
  max-width: 38ch;
}

.action {
  margin-top: 1rem;
}

.heading:empty,
.message:empty {
  display: none;
}
</style>
