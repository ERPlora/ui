<script setup lang="ts">
// StatusPill — the status chip of the SaaS panel (mockups `mockups/saas-panel/`): the old
// `.status-pill .st-*` of `erplora-admin.css` plus the `st-info` tone and the busy pulse of
// `mock.css`, rebuilt with our tokens. A short label on a tint of its tone, with a dot of the same
// colour. For the panel's own statuses use the helpers of `statuses.ts`, which give tone and label:
//   <StatusPill v-bind="businessStatusPill(row.status)" />
// Colours (WCAG AA on every surface, light and dark; `StatusPill.contrast.test.ts`): one tone per
// pill; the tint is that tone over the surface and the text is the tone mixed with black (light)
// or with white (dark), each tone by its own amount.
//   - default slot → replaces `label` (e.g. a status with a date)
// It never grows past its box (hub#53: a narrow table cell cut «● Document pending» to «● Document
// pend»): the label wraps between words, a word that alone does not fit ends in «…», and the label
// is the pill's `title`, so the whole text is one hover away.
import type { StatusPillSize, StatusPillTone } from './types';

withDefaults(
  defineProps<{
    /** Text of the pill. */
    label?: string;
    /** Colour by meaning. */
    tone?: StatusPillTone;
    /** Leading dot in the tone's colour. */
    dot?: boolean;
    /** The dot pulses: something is in progress. */
    busy?: boolean;
    /** `md` is the pill of the mockups; `sm` is tighter, for dense rows. */
    size?: StatusPillSize;
  }>(),
  { label: '', tone: 'neutral', dot: true, busy: false, size: 'md' },
);

defineSlots<{ default?: () => unknown }>();
</script>

<template>
  <span
    class="status-pill"
    :class="{ 'status-pill--dot': dot, 'status-pill--busy': busy }"
    :data-tone="tone"
    :data-size="size"
    :title="$slots.default ? undefined : label || undefined"
  >
    <span class="status-pill__label"><slot>{{ label }}</slot></span>
  </span>
</template>

<style scoped>
.status-pill {
  /* The tone (neutral by default) and how much of it each part takes: the tint over the surface,
     and the text, darkened in light and lightened in dark. A tone rule below reassigns them. */
  --status-pill-tone: var(--ep-medium, var(--ion-color-medium, #636469));
  --status-pill-wash: 14%;
  --status-pill-ink: 75%;
  --status-pill-ink-dark: 70%;

  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  flex: none;
  box-sizing: border-box;
  max-width: 100%;
  padding: 0.15rem 0.6rem;
  border-radius: var(--ep-radius-pill, 999px);
  font-size: 11.5px;
  font-weight: 500;
  line-height: 1.4;
  color: color-mix(in srgb, var(--status-pill-tone) var(--status-pill-ink), black);
  background: color-mix(in srgb, var(--status-pill-tone) var(--status-pill-wash), transparent);
}
:root.ion-palette-dark .status-pill {
  color: color-mix(in srgb, var(--status-pill-tone) var(--status-pill-ink-dark), white);
}

.status-pill[data-tone='success'] {
  --status-pill-tone: var(--ep-success, var(--ion-color-success, #2dd55b));
  --status-pill-ink: 55%;
  --status-pill-ink-dark: 70%;
}
.status-pill[data-tone='info'] {
  --status-pill-tone: var(--ep-primary, var(--ion-color-primary, #0054e9));
  --status-pill-ink: 70%;
  --status-pill-ink-dark: 65%;
}
.status-pill[data-tone='warning'] {
  --status-pill-tone: var(--ep-warning, var(--ion-color-warning, #ffc409));
  --status-pill-wash: 18%;
  --status-pill-ink: 50%;
  --status-pill-ink-dark: 90%;
}
.status-pill[data-tone='danger'] {
  --status-pill-tone: var(--ep-danger, var(--ion-color-danger, #c5000f));
  --status-pill-ink: 80%;
  --status-pill-ink-dark: 65%;
}

.status-pill[data-size='sm'] {
  gap: 0.25rem;
  padding: 0.1rem 0.45rem;
  font-size: 10.5px;
}

/* Its own `white-space`: a table cell paints its spans on one line, and that would cut the pill. */
.status-pill__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: normal;
}

/* The dot: decoration, so a pseudo-element (nothing for a screen reader to read). */
.status-pill--dot::before {
  content: '';
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: currentColor;
}
.status-pill--busy::before {
  animation: status-pill-pulse 1.1s ease-in-out infinite;
}
@keyframes status-pill-pulse {
  0%,
  100% { opacity: 0.35; }
  50% { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .status-pill--busy::before { animation: none; }
}
</style>
