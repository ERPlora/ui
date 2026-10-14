<script setup lang="ts">
// UserAvatar — the round avatar of a person in the SaaS panel (mockups `mockups/saas-panel/`: the
// sidebar header of every screen, the account profile, member rows): the old `.avatar` of
// `mock.css`, rebuilt with our tokens. The person's initials on a tint of their tone, or their photo
// once it loads (a photo that fails leaves the initials).
//   <UserAvatar :name="member.name" :email="member.email" :src="member.photo" size="sm" />
// Contract:
//   - Initials: first letters of the first two words of `name`; else the first letter of `email`;
//     else «?» (`avatar.ts`).
//   - Tone: `tone` if given; else a hash of the name (the email without one) over a small palette,
//     the same colour for the same person on every screen.
//   - An image named after the person (`role="img"`, `aria-label` = name, else email, else «Unknown
//     user»). `decorative` hides it from screen readers where the name is printed next to it (the
//     sidebar header), so it is not read twice.
// Colours (WCAG AA in every theme, light and dark; `UserAvatar.contrast.test.ts`): one tone per
// avatar; the tint is that tone over the surface and the initials are the tone mixed with black
// (light) or with white (dark), each tone by its own amount.
import { computed, shallowRef, watch } from 'vue';

import { shellLocale } from '../../shell/i18n';
import { useComponentLocale } from '../locale';
import { avatarInitials, avatarTone } from './avatar';
import en from './locales/en.json';
import es from './locales/es.json';
import type { UserAvatarSize, UserAvatarTone } from './types';

const CATALOGUES = { en: en.userAvatar, es: es.userAvatar } as const;

const props = withDefaults(
  defineProps<{
    /** The person's name: the initials, the tone and the accessible name. */
    name: string;
    /** Used when there is no name. */
    email?: string;
    /** URL of the person's photo. */
    src?: string | null;
    /** `sm` 24px, `md` 32px, `lg` 40px, `xl` 72px. */
    size?: UserAvatarSize;
    /** Colour without a photo; by default, the tone of the name. */
    tone?: UserAvatarTone;
    /** Hidden from screen readers: the page prints the name next to it. */
    decorative?: boolean;
  }>(),
  { email: undefined, src: undefined, size: 'md', tone: undefined, decorative: false },
);

const locale = useComponentLocale();

/** Who the avatar is for: the name, else the email (both trimmed); `''` when neither says. */
const who = computed(() => props.name.trim() || props.email?.trim() || '');
const initials = computed(() => avatarInitials(props.name, props.email));
const label = computed(() => who.value || CATALOGUES[shellLocale(locale.value)].unknown);
const shownTone = computed<UserAvatarTone>(() => props.tone ?? avatarTone(who.value));

/** The photo of `src`: loading (initials under it), loaded (initials gone) or failed (no image). */
const photo = shallowRef<'loading' | 'loaded' | 'failed'>('loading');
watch(
  () => props.src,
  () => {
    photo.value = 'loading';
  },
);
</script>

<template>
  <span
    class="user-avatar"
    :data-size="size"
    :data-tone="shownTone"
    :role="decorative ? undefined : 'img'"
    :aria-label="decorative ? undefined : label"
    :aria-hidden="decorative ? 'true' : undefined"
  >
    <span
      v-if="photo !== 'loaded'"
      class="user-avatar__initials"
    >{{ initials }}</span>
    <img
      v-if="src && photo !== 'failed'"
      class="user-avatar__img"
      :src="src"
      alt=""
      @load="photo = 'loaded'"
      @error="photo = 'failed'"
    >
  </span>
</template>

<style scoped>
.user-avatar {
  /* The tone (the brand's by default) and how much of it each part takes: the tint over the
     surface, and the initials, darkened in light and lightened in dark. A tone rule below
     reassigns them; a size rule, the box and the type. */
  --user-avatar-size: 32px;
  --user-avatar-tone: var(--ep-primary, var(--ion-color-primary, #0054e9));
  --user-avatar-wash: 15%;
  --user-avatar-ink: 70%;
  --user-avatar-ink-dark: 65%;

  position: relative;
  display: inline-grid;
  place-items: center;
  flex: none;
  width: var(--user-avatar-size);
  height: var(--user-avatar-size);
  border-radius: 50%;
  overflow: hidden;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1;
  user-select: none;
  color: color-mix(in srgb, var(--user-avatar-tone) var(--user-avatar-ink), black);
  background: color-mix(in srgb, var(--user-avatar-tone) var(--user-avatar-wash), transparent);
}
:root.ion-palette-dark .user-avatar {
  color: color-mix(in srgb, var(--user-avatar-tone) var(--user-avatar-ink-dark), white);
}

.user-avatar[data-tone='green'] {
  --user-avatar-tone: var(--ep-success, var(--ion-color-success, #2dd55b));
  --user-avatar-ink: 55%;
  --user-avatar-ink-dark: 70%;
}
.user-avatar[data-tone='violet'] {
  --user-avatar-tone: var(--ep-secondary, var(--ion-color-secondary, #0163aa));
  --user-avatar-ink: 70%;
  --user-avatar-ink-dark: 60%;
}
.user-avatar[data-tone='amber'] {
  --user-avatar-tone: var(--ep-warning, var(--ion-color-warning, #ffc409));
  --user-avatar-wash: 18%;
  --user-avatar-ink: 50%;
  --user-avatar-ink-dark: 90%;
}

.user-avatar[data-size='sm'] {
  --user-avatar-size: 24px;
  font-size: 10px;
}
.user-avatar[data-size='md'] {
  --user-avatar-size: 32px;
  font-size: 12px;
}
.user-avatar[data-size='lg'] {
  --user-avatar-size: 40px;
  font-size: 14px;
}
/* The account header of the mockups (`.avatar.is-lg` of mock.css). */
.user-avatar[data-size='xl'] {
  --user-avatar-size: 72px;
  font-size: 1.4rem;
}

/* The photo covers the initials while it loads, and replaces them once it has. */
.user-avatar__img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
