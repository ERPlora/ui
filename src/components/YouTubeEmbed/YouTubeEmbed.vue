<script setup lang="ts">
// Before the tap only our own poster is painted: no iframe and no thumbnail, so nothing is requested from Google. The
// player's sandbox has neither `allow-popups` nor `allow-top-navigation`: without it, a tap on the YouTube logo inside
// the player replaces the whole app window with youtube.com. Without the referrer policy, YouTube refuses to play.
import { computed, nextTick, shallowRef, useId, useTemplateRef, watch } from 'vue';

import HubIcon from '../../shell/HubIcon.vue';
import { shellLocale } from '../../shell/i18n';
import { useComponentLocale } from '../locale';
import { useOnline } from '../online';
import en from './locales/en.json';
import es from './locales/es.json';
import { youtubeEmbedSrc } from './youtube';

const CATALOGUES = { en: en.youtubeEmbed, es: es.youtubeEmbed } as const;

const props = withDefaults(
  defineProps<{
    /** The 11-character YouTube id; anything else paints nothing. */
    videoId: string;
    /** What the video is about: the poster's title and the player's accessible name. */
    title: string;
    /** Its length as the page writes it («2 min»). */
    duration?: string;
    /** Icon next to the title (`set:name`, registered in `shell/icons.ts`). */
    icon?: string;
  }>(),
  { duration: undefined, icon: undefined },
);

const locale = useComponentLocale();
const text = computed(() => CATALOGUES[shellLocale(locale.value)]);
const playLabel = computed(() => text.value.play.replace('{title}', () => props.title));
const src = computed(() => youtubeEmbedSrc(props.videoId));
const online = useOnline();
const captionId = useId();

const playing = shallowRef(false);
const root = useTemplateRef<HTMLElement>('root');
const player = useTemplateRef<HTMLIFrameElement>('player');
const offlineCard = useTemplateRef<HTMLElement>('offlineCard');
const poster = useTemplateRef<HTMLButtonElement>('poster');

/** What is shown: the player once asked for, else the offline card or the poster. */
const shown = computed(() => (playing.value ? 'player' : online.value ? 'poster' : 'offline'));

watch(
  () => props.videoId,
  () => {
    playing.value = false;
  },
);

// Read before Vue swaps the elements: what replaces the focused one takes the focus, so a keyboard or screen-reader user
// keeps their place instead of falling to the page's body. A focus somewhere else is left alone.
watch(
  shown,
  async () => {
    if (!root.value?.contains(document.activeElement)) return;
    await nextTick();
    (player.value ?? offlineCard.value ?? poster.value)?.focus();
  },
  { flush: 'pre' },
);

async function play(): Promise<void> {
  playing.value = true;
  await nextTick();
  player.value?.focus();
}
</script>

<template>
  <div
    v-if="src"
    ref="root"
    class="youtube-embed"
  >
    <iframe
      v-if="playing"
      ref="player"
      class="youtube-embed__frame youtube-embed__player"
      :src="src"
      :title="title"
      referrerpolicy="strict-origin-when-cross-origin"
      allow="autoplay; encrypted-media; picture-in-picture"
      sandbox="allow-scripts allow-same-origin allow-presentation"
    />
    <div
      v-else-if="!online"
      ref="offlineCard"
      class="youtube-embed__frame youtube-embed__offline"
      role="status"
      tabindex="-1"
    >
      <HubIcon
        class="youtube-embed__offline-icon"
        name="ion:cloud-offline-outline"
      />
      <strong>{{ text.offline }}</strong>
    </div>
    <template v-else>
      <button
        ref="poster"
        type="button"
        class="youtube-embed__frame youtube-embed__poster"
        :aria-label="playLabel"
        :aria-describedby="captionId"
        @click="play"
      >
        <span class="youtube-embed__copy">
          <HubIcon
            v-if="icon"
            class="youtube-embed__icon"
            :name="icon"
          />
          <span>
            <strong class="youtube-embed__title">{{ title }}</strong>
            <small
              v-if="duration"
              class="youtube-embed__duration"
            >{{ duration }}</small>
          </span>
        </span>
        <span class="youtube-embed__play">
          <HubIcon
            class="youtube-embed__play-icon"
            name="ion:play"
          />
        </span>
      </button>
      <p
        :id="captionId"
        class="youtube-embed__caption"
      >
        {{ text.caption }}
      </p>
    </template>
  </div>
</template>

<style scoped>
.youtube-embed {
  /* The poster is a dark video surface in light and dark alike; the glow takes the theme's primary colour. */
  --youtube-embed-radius: var(--ep-radius-lg, 16px);
  --youtube-embed-from: #153449;
  --youtube-embed-to: #0b1c29;
  --youtube-embed-glow: color-mix(in srgb, var(--ion-color-primary, #1496d6) 20%, transparent);
  --youtube-embed-ink: #f5fbff;
  --youtube-embed-ink-muted: #c3d6e2;
  --youtube-embed-accent: #9cddfa;
  display: block;
  width: 100%;
}

.youtube-embed__frame {
  position: relative;
  display: grid;
  place-items: center;
  box-sizing: border-box;
  width: 100%;
  aspect-ratio: 16 / 9;
  margin: 0;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: var(--youtube-embed-radius);
  text-align: center;
}

.youtube-embed__player {
  display: block;
  background: var(--youtube-embed-to);
}

.youtube-embed__poster {
  font: inherit;
  color: var(--youtube-embed-ink);
  cursor: pointer;
  background:
    radial-gradient(circle at 75% 20%, var(--youtube-embed-glow), transparent 42%),
    linear-gradient(145deg, var(--youtube-embed-from), var(--youtube-embed-to));
  transition: transform var(--ep-transition, 150ms ease);
}
.youtube-embed__poster:active {
  transform: scale(var(--ep-press-scale, 0.97));
}
.youtube-embed__poster:focus-visible {
  outline: 2px solid var(--ion-color-primary, #1496d6);
  outline-offset: 3px;
}

.youtube-embed__copy {
  position: absolute;
  top: 22px;
  left: 24px;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: left;
}
.youtube-embed__icon {
  flex: none;
  font-size: 29px;
  color: var(--youtube-embed-accent);
}
.youtube-embed__title {
  display: block;
  font-size: 1rem;
  font-weight: 650;
}
.youtube-embed__duration {
  display: block;
  margin-top: 3px;
  font-size: 0.75rem;
  color: var(--youtube-embed-ink-muted);
}

.youtube-embed__play {
  display: grid;
  place-items: center;
  width: 68px;
  height: 68px;
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.16);
  box-shadow: 0 10px 35px rgba(0, 0, 0, 0.24);
}
.youtube-embed__play-icon {
  margin-left: 4px;
  font-size: 32px;
}

.youtube-embed__caption {
  margin: 8px 2px 0;
  font-size: 0.75rem;
  color: var(--ep-text-muted, #646b78);
}

.youtube-embed__offline {
  align-content: center;
  gap: 10px;
  padding: 22px;
  border: 1px solid var(--ion-border-color, #e7e9ee);
  background: var(--ion-color-light, #f4f5f8);
  color: var(--ep-text-muted, #646b78);
}
.youtube-embed__offline:focus-visible {
  outline: 2px solid var(--ion-color-primary, #1496d6);
  outline-offset: 3px;
}
.youtube-embed__offline-icon {
  font-size: 32px;
}
.youtube-embed__offline strong {
  font-size: 0.875rem;
  color: var(--ion-text-color, #1a1c20);
}

@media (max-width: 479.98px) {
  .youtube-embed__copy {
    top: 14px;
    left: 16px;
    right: 16px;
  }
  .youtube-embed__play {
    width: 56px;
    height: 56px;
  }
  .youtube-embed__play-icon {
    font-size: 28px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .youtube-embed__poster {
    transition: none;
  }
  .youtube-embed__poster:active {
    transform: none;
  }
}
</style>
