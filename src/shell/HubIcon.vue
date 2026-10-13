<script setup lang="ts">
// HubIcon: the ONE icon component (PLAN §16.4). `<HubIcon name="ion:cart-outline" />`,
// `name="lucide:panel-left"`, `name="mdi:cart"`… The name carries its set. Every set paints through
// `ion-icon`, so the box (1em, currentColor), `color="primary"` and `slot="start|end|icon-only"`
// inside ion-button/ion-item are exactly Ionic's. Only icons registered in `icons.ts` exist: an
// unknown one throws in dev and tests; in production it is reported and paints nothing.
import { IonIcon } from '@ionic/vue';
import { computed } from 'vue';

import { ION_ICONS, resolveIcon } from './icons';

const props = defineProps<{
  /** `set:name`, e.g. `ion:cart-outline` or `lucide:panel-left`. */
  name: string;
}>();

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
  />
</template>
