<script setup lang="ts">
// EmptyState — centred "nothing here" (no data, no results...): large muted icon + heading + muted
// message + optional action. Vue port of OutfitKit's `ok-empty-state` (PLAN §16.11), same DOM and
// same look; the light DOM replaces the shadow root.
//   - default slot → extra content, after the message
//   - `action` slot → the action, under the text (typically an ion-button)
import { IonIcon } from '@ionic/vue';
import { computed } from 'vue';

import { ionIconSrc } from '../../shell/icons';

const props = withDefaults(
  defineProps<{
    /** Icon (`ion:` by default, any baked set, or inline SVG). */
    icon?: string;
    /** Main title. */
    heading?: string;
    /** Secondary, muted message. */
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
/* Block at 100% of its container. */
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

/* Content centred vertically and horizontally. */
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
  opacity: 0.5; /* muted */
  margin-bottom: 0.25rem;
}

.heading {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--heading-color);
  /* The global h2 type of the shell (Ionic typography, polish.css) never reached the shadow root
     this lived in: the heading inherits from its context, as it did there. */
  line-height: inherit;
  letter-spacing: inherit;
}

.message {
  margin: 0;
  font-size: 0.9375rem;
  color: var(--message-color);
  max-width: 38ch;
}

/* The action, under the text. */
.action {
  margin-top: 1rem;
}

/* Hide the wrappers when empty. */
.heading:empty,
.message:empty {
  display: none;
}
</style>
