<script setup lang="ts">
// A notice that stays in the flow of the content, which Ionic lacks: ion-toast and ion-alert are ephemeral or modal.
// The `actions` slot sits to the right of the text and drops below it on a phone.
import { IonIcon } from '@ionic/vue';
import { Comment, computed, Fragment, Text, type VNode } from 'vue';
import { useI18n } from 'vue-i18n';

import { ionIconSrc } from '../../shell/icons';

export type InlineFeedbackTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

const props = withDefaults(
  defineProps<{
    /** Tone of the banner: sets its colour and its default icon. */
    tone?: InlineFeedbackTone;
    heading?: string;
    /** Icon (`ion:` by default, any baked set, or inline SVG) replacing the tone's one. */
    icon?: string;
    /** Shows the close button. */
    dismissible?: boolean;
    /** Live-region role of the notice: `alert` interrupts the screen reader, `status` waits its turn. */
    role?: 'status' | 'alert';
  }>(),
  { tone: 'info', heading: undefined, icon: undefined, dismissible: false, role: 'status' },
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
      :role="role"
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
  /* Overridable, Ionic style. Each tone sets the theme's pair of tint and AA text; the tint is
     washed over whatever surface holds the notice, so it reads as part of the page, not a box. */
  --tone-tint: var(--ep-primary-tint, #e3f2fa);
  --tone-text: var(--ep-primary-text, #0b5f8a);
  --background-opacity: 55%;
  --color: var(--ep-text, var(--ion-text-color, #1c1b17));
  /* The muted grey alone falls just under AA on the tints of some palettes; a touch of the text
     colour lifts it in light and in dark. */
  --color-secondary: color-mix(in srgb, var(--ep-text-muted, #646b78) 90%, var(--color));
  --border-radius: var(--ep-radius-md, 12px);
  --padding: 0.75rem 1rem;
  --font: var(--ep-font, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif);

  display: block;
  width: 100%;
  font-family: var(--font);
  box-sizing: border-box;
}
.inline-feedback[hidden] { display: none; }

.inline-feedback[data-tone='success'] { --tone-tint: var(--ep-success-tint, #e5f2ea); --tone-text: var(--ep-success-text, #176b38); }
.inline-feedback[data-tone='warning'] { --tone-tint: var(--ep-warning-tint, #fcf5e3); --tone-text: var(--ep-warning-text, #7a4f00); }
.inline-feedback[data-tone='danger'] { --tone-tint: var(--ep-danger-tint, #fae8ea); --tone-text: var(--ep-danger-text, #b42f3f); }
.inline-feedback[data-tone='neutral'] { --tone-tint: var(--ion-color-step-150, #e3e5ea); --tone-text: var(--color-secondary); }

.box {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 3.5rem;
  padding: var(--padding);
  box-sizing: border-box;
  border-radius: var(--border-radius);
  background: color-mix(in srgb, var(--tone-tint) var(--background-opacity), transparent);
  color: var(--color);
}

.icon {
  flex: 0 0 auto;
  font-size: 1.5rem;
  color: var(--tone-text);
}

.content {
  flex: 1 1 auto;
  min-width: 0;
}
.row {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.text {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}
.heading {
  font-weight: 600;
  font-size: 0.95rem;
  line-height: 1.35;
}
.body {
  font-size: 0.92rem;
  line-height: 1.45;
}
.heading + .body { color: var(--color-secondary); }

/* The buttons' 48px touch area reaches into the box padding, so actions add no height. */
.actions {
  flex: 0 0 auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem;
  margin: -0.5rem -0.5rem -0.5rem 0;
}
.actions.empty { display: none; }
.actions :slotted(ion-button) {
  --background: transparent;
  --background-hover: var(--tone-text);
  --background-hover-opacity: 0.08;
  --background-activated: var(--tone-text);
  --background-activated-opacity: 0.12;
  --background-focused: var(--tone-text);
  --background-focused-opacity: 0.12;
  --border-width: 0;
  --box-shadow: none;
  --color: var(--tone-text);
  --padding-start: 0.75rem;
  --padding-end: 0.75rem;
  min-height: var(--ep-touch-min, 48px);
  margin: 0;
  font-size: 0.92rem;
  font-weight: 700;
}

.close {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: var(--ep-touch-min, 48px);
  height: var(--ep-touch-min, 48px);
  margin: -0.5rem -0.5rem -0.5rem 0;
  padding: 0;
  border: 0;
  border-radius: var(--ep-radius-sm, 10px);
  background: none;
  color: var(--color-secondary);
  font-size: 1.25rem;
  cursor: pointer;
  transition: background-color var(--ep-transition, 150ms ease), color var(--ep-transition, 150ms ease),
    transform 120ms ease;
}
@media (hover: hover) {
  .close:hover { background: color-mix(in srgb, var(--color-secondary) 12%, transparent); color: var(--color); }
}
.close:focus-visible { outline: 2px solid var(--tone-text); outline-offset: -2px; }
.close:active { transform: scale(var(--ep-press-scale, 0.97)); }

@media (max-width: 640px) {
  .row { flex-direction: column; align-items: flex-start; gap: 0.25rem; }
  .actions { margin: 0 0 -0.5rem -0.75rem; }
}
@media (prefers-reduced-motion: reduce) {
  .close { transition: none; }
  .close:active { transform: none; }
}
</style>
