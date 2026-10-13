<script setup lang="ts">
// InlineFeedback — a banner/callout that stays in the flow of the content (the gap Ionic leaves:
// ion-toast and ion-alert are ephemeral or modal, not a persistent embedded notice). Bootstrap
// "alert" / Tailwind "callout" style. Vue port of OutfitKit's `ok-inline-feedback` (PLAN §16.11),
// same DOM and same look; the light DOM replaces the shadow root.
//   - default slot     → the message
//   - `actions` slot   → action buttons (to the right; they drop below the text on a phone)
// Layout: [icon] | (heading + message + actions) [· close]. Closing hides it and emits `dismiss`;
// `v-model:hidden` lets the parent show it again.
import { IonIcon } from '@ionic/vue';
import { Comment, computed, Fragment, Text, type VNode } from 'vue';
import { useI18n } from 'vue-i18n';

import { ionIconSrc } from '../../shell/icons';

export type InlineFeedbackTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

const props = withDefaults(
  defineProps<{
    /** Tone of the banner: sets its colour and its default icon. */
    tone?: InlineFeedbackTone;
    /** Bold title (optional). */
    heading?: string;
    /** Icon (`ion:` by default, any baked set, or inline SVG) replacing the tone's one. */
    icon?: string;
    /** Shows the close button. */
    dismissible?: boolean;
  }>(),
  { tone: 'info', heading: undefined, icon: undefined, dismissible: false },
);

/** Hidden state: the close button sets it; the parent may bind it (`v-model:hidden`). */
const hidden = defineModel<boolean>('hidden', { default: false });

const emit = defineEmits<{ dismiss: [] }>();

const slots = defineSlots<{ default?: () => VNode[]; actions?: () => VNode[] }>();

const { t } = useI18n();

const TONE_ICONS: Record<InlineFeedbackTone, string> = {
  info: 'information-circle',
  success: 'checkmark-circle',
  warning: 'warning',
  danger: 'alert-circle',
  neutral: 'information-circle',
};

const iconSrc = computed(() => ionIconSrc(props.icon ?? TONE_ICONS[props.tone] ?? TONE_ICONS.info));
const closeIconSrc = ionIconSrc('close');

/** Whether a slot renders something (a `v-if` that is false leaves only a comment). */
function rendersContent(nodes: VNode[] | undefined): boolean {
  return (nodes ?? []).some((node) => {
    if (node.type === Comment) return false;
    if (node.type === Text) return String(node.children ?? '').trim() !== '';
    if (node.type === Fragment) return rendersContent(node.children as VNode[]);
    return true;
  });
}

// Called while rendering, so it is re-evaluated whenever the slot content changes.
const hasActions = (): boolean => rendersContent(slots.actions?.());

function dismiss(): void {
  hidden.value = true;
  emit('dismiss');
}
</script>

<template>
  <div
    class="inline-feedback"
    :data-tone="tone"
    :hidden="hidden || undefined"
  >
    <div
      class="box"
      role="status"
    >
      <ion-icon
        class="icon"
        :icon="iconSrc"
        aria-hidden="true"
      />
      <div class="content">
        <div class="row">
          <div class="text">
            <div
              v-if="heading"
              class="heading"
            >
              {{ heading }}
            </div>
            <div class="body">
              <slot />
            </div>
          </div>
          <div
            class="actions"
            :class="{ empty: !hasActions() }"
          >
            <slot name="actions" />
          </div>
        </div>
      </div>
      <button
        v-if="dismissible"
        type="button"
        class="close"
        :aria-label="t('inlineFeedback.dismiss')"
        @click="dismiss"
      >
        <ion-icon
          :icon="closeIconSrc"
          aria-hidden="true"
        />
      </button>
    </div>
  </div>
</template>

<style scoped>
.inline-feedback {
  /* Overridable vars (Ionic style), default = chain --ep-* → --ion-* → hex. --tone-color is
     reassigned per tone below. */
  --tone-color: var(--ep-primary, var(--ion-color-primary, #3880ff));
  --background-opacity: 0.1;
  --color: var(--ep-text, var(--ion-text-color, #1c1b17));
  --border-radius: var(--ep-radius, var(--ion-border-radius, 8px));
  --padding: var(--ep-spacing, var(--ion-padding, 16px));
  --accent-width: 4px;
  --font: var(--ep-font, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif);

  /* Responsive: the banner takes the width of its container. */
  display: block;
  width: 100%;
  font-family: var(--font);
  box-sizing: border-box;
}
.inline-feedback[hidden] { display: none; }

/* Tone → Ionic colour (info / no tone → primary, the default above). */
.inline-feedback[data-tone='success'] { --tone-color: var(--ep-success, var(--ion-color-success, #2dd55b)); }
.inline-feedback[data-tone='warning'] { --tone-color: var(--ep-warning, var(--ion-color-warning, #ffc409)); }
.inline-feedback[data-tone='danger']  { --tone-color: var(--ep-danger, var(--ion-color-danger, #c5000f)); }
.inline-feedback[data-tone='neutral'] { --tone-color: var(--ep-medium, var(--ion-color-medium, #5f5f5f)); }

.box {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: var(--padding);
  border-radius: var(--border-radius);
  border-inline-start: var(--accent-width) solid var(--tone-color);
  /* Tonal background: the tone colour at low opacity. */
  background: color-mix(in srgb, var(--tone-color) calc(var(--background-opacity) * 100%), transparent);
  color: var(--color);
}

.icon {
  flex: 0 0 auto;
  font-size: 1.4rem;
  line-height: 1;
  color: var(--tone-color);
  margin-top: 0.05rem;
}

.content {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.row {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}
.text {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.heading {
  font-weight: 700;
  font-size: 0.98rem;
  line-height: 1.3;
}
.body {
  font-size: 0.92rem;
  line-height: 1.45;
}
.actions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
/* With nothing in the actions slot, the container takes no room. */
.actions.empty { display: none; }

.close {
  flex: 0 0 auto;
  background: none;
  border: 0;
  cursor: pointer;
  padding: 0.15rem;
  margin: -0.15rem -0.15rem 0 0;
  color: inherit;
  opacity: 0.6;
  font-size: 1.2rem;
  line-height: 1;
  border-radius: 4px;
  transition: background-color var(--ep-transition, 150ms ease), color var(--ep-transition, 150ms ease),
    border-color var(--ep-transition, 150ms ease), box-shadow var(--ep-transition, 150ms ease),
    opacity 0.15s ease, transform 120ms ease;
}
@media (hover: hover) {
  .close:hover { opacity: 1; background: rgba(var(--ion-text-color-rgb, 24, 24, 27), 0.07); }
}
.close:active { transform: scale(var(--ep-press-scale, 0.97)); }

/* Phone: the actions drop below the text (stacked, full width). */
@media (max-width: 640px) {
  .row { flex-direction: column; align-items: stretch; }
  .actions { width: 100%; }
}
@media (prefers-reduced-motion: reduce) {
  .close:hover,
  .close:active { transform: none; }
}
</style>
