<script setup lang="ts">
// HubIcon: the ONE icon component (PLAN §16.4). `<HubIcon name="ion:cart-outline" />`,
// `name="lucide:panel-left"`, `name="mdi:cart"`… The name carries its set. Every set paints through
// `ion-icon`, so the box (1em, currentColor), `color="primary"` and `slot="start|end|icon-only"`
// inside ion-button/ion-item are exactly Ionic's. Only icons registered in `icons.ts` exist: an
// unknown one throws in dev and tests; in production it is reported and paints nothing.
// Accessibility: an icon is DECORATIVE by default (`aria-hidden="true"`, no role, no name) — the
// common case, next to a text that already says what it is (menu entry, button, notice). Give it a
// `label` only when the icon alone carries the meaning: `<HubIcon name="ion:warning" label="Overdue" />`
// → `role="img"` + `aria-label`. A raw `aria-label` attribute counts as a label; `decorative` hides it
// even with one. An icon-only button is named on the BUTTON (`aria-label`), its icon stays decorative.
import { IonIcon } from '@ionic/vue';
import { computed, useAttrs } from 'vue';

import { ION_ICONS, resolveIcon } from './icons';

const props = defineProps<{
  /** `set:name`, e.g. `ion:cart-outline` or `lucide:panel-left`. */
  name: string;
  /** What the icon means on its own: makes it an image (`role="img"`) named by it. */
  label?: string;
  /** Hidden from screen readers even with a `label` (the default without one). */
  decorative?: boolean;
}>();

const attrs = useAttrs();

/** The accessible name, or `undefined` for a decorative icon. */
const accessibleName = computed<string | undefined>(() => {
  if (props.decorative) return undefined;
  const raw = attrs['aria-label'];
  return props.label || (typeof raw === 'string' && raw ? raw : undefined);
});

/** Named → an image with that name; otherwise hidden from the accessibility tree. */
const a11y = computed(() =>
  accessibleName.value
    ? { role: 'img', 'aria-label': accessibleName.value, 'aria-hidden': undefined }
    : { role: undefined, 'aria-label': undefined, 'aria-hidden': 'true' as const },
);

/** `ion:` by name (the `addIcons` registry, as a plain ion-icon); any other set by its baked SVG. */
const paint = computed<{ name?: string; icon?: string }>(() => {
  const { name } = props;
  if (name.startsWith('ion:') && Object.hasOwn(ION_ICONS, name.slice(4))) return { name: name.slice(4) };
  const icon = name.includes(':') ? resolveIcon(name) : undefined;
  if (icon) return { icon };
  const problem = `HubIcon: unknown icon "${name}". Names carry their set ("ion:cart-outline", "lucide:panel-left") and must be registered in @erplora/ui src/shell/icons.ts.`;
  if (import.meta.env.DEV) throw new Error(problem);
  console.error(problem);
  return {};
});
</script>

<template>
  <ion-icon
    :name="paint.name"
    :icon="paint.icon"
    v-bind="a11y"
  />
</template>
