// A YouTube video that costs nothing until the person asks for it: before the tap only our own poster (no iframe, no
// thumbnail, nothing requested from Google); on the tap, the privacy-enhanced player, sandboxed so a tap on its logo
// cannot take the app's window to youtube.com; offline, a card instead of the poster.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

import * as root from '../../index';
import HubIcon from '../../shell/HubIcon.vue';
import { createShellI18n } from '../../shell/i18n';
import { blocks, componentCss } from '../__tests__/themeContrast';
import * as components from '../index';
import * as entry from './index';
import YouTubeEmbed from './YouTubeEmbed.vue';

const SFC = join(dirname(fileURLToPath(import.meta.url)), 'YouTubeEmbed.vue');
const ID = 'dQw4w9WgXcQ';
const SRC = `https://www.youtube-nocookie.com/embed/${ID}?autoplay=1&fs=0&rel=0&playsinline=1`;

type Props = InstanceType<typeof YouTubeEmbed>['$props'];

const mounted: VueWrapper[] = [];

function mountEmbed(props: Partial<Props> = {}, locale = 'en'): VueWrapper {
  const wrapper = mount(YouTubeEmbed, {
    props: { videoId: ID, title: 'How Tables works', duration: '2 min', ...props } as Props,
    attachTo: document.body,
    global: { plugins: [createShellI18n({ locale })] },
  });
  mounted.push(wrapper);
  return wrapper;
}

const setOnLine = (value: boolean) => vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(value);

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  vi.restoreAllMocks();
});

describe('YouTubeEmbed: before the tap', () => {
  it('paints only our poster, a button named after the video, and says the video loads from YouTube on tap', () => {
    const wrapper = mountEmbed();
    const poster = wrapper.get('button');
    expect(poster.attributes('type')).toBe('button');
    expect(poster.attributes('aria-label')).toBe('Play How Tables works');
    expect(poster.text()).toContain('How Tables works');
    expect(poster.text()).toContain('2 min');
    const caption = wrapper.get('.youtube-embed__caption');
    expect(caption.text()).toBe('The video loads from YouTube when you tap it.');
    expect(poster.attributes('aria-describedby')).toBe(caption.attributes('id'));
  });

  it('requests nothing: no iframe, no image, nothing with a src or a link', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const wrapper = mountEmbed();
    expect(wrapper.find('iframe').exists()).toBe(false);
    expect(wrapper.findAll('img, picture, video, link, script, [src], [href], [srcset]')).toHaveLength(0);
    expect(wrapper.html()).not.toMatch(/youtube(-nocookie)?\.com|ytimg|googlevideo|google\./);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('paints the icon it is given next to the title, decorative, and leaves the duration out when there is none', () => {
    const withIcon = mountEmbed({ icon: 'ion:grid-outline', duration: undefined });
    const copyIcon = withIcon.get('.youtube-embed__copy').getComponent(HubIcon);
    expect(copyIcon.props('name')).toBe('ion:grid-outline');
    expect(copyIcon.attributes('aria-hidden')).toBe('true');
    expect(withIcon.find('.youtube-embed__duration').exists()).toBe(false);

    const without = mountEmbed();
    expect(without.get('.youtube-embed__copy').findComponent(HubIcon).exists()).toBe(false);
    expect(without.get('.youtube-embed__play').getComponent(HubIcon).props('name')).toBe('ion:play');
  });

  it('speaks Spanish with a Spanish locale', () => {
    const wrapper = mountEmbed({ title: 'Cómo funciona Mesas' }, 'es');
    expect(wrapper.get('button').attributes('aria-label')).toBe('Reproducir Cómo funciona Mesas');
    expect(wrapper.get('.youtube-embed__caption').text()).toBe('El vídeo se carga desde YouTube al pulsar.');
  });
});

describe('YouTubeEmbed: on the tap', () => {
  it('swaps the poster for the privacy-enhanced player, inline, named after the video, and moves the focus to it', async () => {
    const wrapper = mountEmbed();
    await wrapper.get('button').trigger('click');
    await nextTick();
    expect(wrapper.find('button').exists()).toBe(false);
    expect(wrapper.find('.youtube-embed__caption').exists()).toBe(false);
    const frame = wrapper.get('iframe');
    expect(frame.attributes('src')).toBe(SRC);
    expect(frame.attributes('title')).toBe('How Tables works');
    expect(document.activeElement).toBe(frame.element);
  });

  it('keeps the referrer YouTube needs, sandboxes the player and allows no fullscreen', async () => {
    const wrapper = mountEmbed();
    await wrapper.get('button').trigger('click');
    const frame = wrapper.get('iframe');
    expect(frame.attributes('referrerpolicy')).toBe('strict-origin-when-cross-origin');
    expect(frame.attributes('allow')).toBe('autoplay; encrypted-media; picture-in-picture');
    // No allow-popups nor allow-top-navigation: a tap on the player's logo cannot replace the app's window.
    expect(frame.attributes('sandbox')).toBe('allow-scripts allow-same-origin allow-presentation');
    expect(frame.attributes()).not.toHaveProperty('allowfullscreen');
  });

  it('goes back to the poster when it is given another video', async () => {
    const wrapper = mountEmbed();
    await wrapper.get('button').trigger('click');
    await wrapper.setProps({ videoId: 'a-b_C1d2E3f', title: 'How Sales works' });
    expect(wrapper.find('iframe').exists()).toBe(false);
    expect(wrapper.get('button').attributes('aria-label')).toBe('Play How Sales works');
  });
});

describe('YouTubeEmbed: what it refuses', () => {
  it('paints nothing for a video id that is not an 11-character YouTube id', () => {
    for (const videoId of ['', 'short', 'dQw4w9WgXcQQ', 'dQw4w9WgXc"', 'dQw4w9WgXc/']) {
      const wrapper = mountEmbed({ videoId });
      expect(wrapper.element.nodeType, videoId).toBe(Node.COMMENT_NODE);
      expect(wrapper.find('button').exists(), videoId).toBe(false);
      expect(wrapper.find('iframe').exists(), videoId).toBe(false);
    }
  });
});

describe('YouTubeEmbed: offline', () => {
  it('shows the offline card instead of the poster, and the poster again once the connection is back', async () => {
    setOnLine(false);
    const wrapper = mountEmbed();
    const card = wrapper.get('.youtube-embed__offline');
    expect(card.attributes('role')).toBe('status');
    expect(card.text()).toBe('Offline: the video is not available');
    expect(card.getComponent(HubIcon).props('name')).toBe('ion:cloud-offline-outline');
    expect(wrapper.find('button').exists()).toBe(false);
    expect(wrapper.find('iframe').exists()).toBe(false);

    setOnLine(true);
    window.dispatchEvent(new Event('online'));
    await nextTick();
    expect(wrapper.find('.youtube-embed__offline').exists()).toBe(false);
    expect(wrapper.get('button').attributes('aria-label')).toBe('Play How Tables works');
  });

  it('turns the poster into the card when the connection drops, in Spanish too', async () => {
    const wrapper = mountEmbed({}, 'es');
    setOnLine(false);
    window.dispatchEvent(new Event('offline'));
    await nextTick();
    expect(wrapper.get('.youtube-embed__offline').text()).toBe('Sin conexión: el vídeo no está disponible');
    expect(wrapper.find('button').exists()).toBe(false);
  });

  it('leaves a player that is already playing alone: YouTube keeps what it buffered', async () => {
    const wrapper = mountEmbed();
    await wrapper.get('button').trigger('click');
    setOnLine(false);
    window.dispatchEvent(new Event('offline'));
    await nextTick();
    expect(wrapper.get('iframe').attributes('src')).toBe(SRC);
    expect(wrapper.find('.youtube-embed__offline').exists()).toBe(false);
  });
});

// Inside the help window a keyboard or screen-reader user must not be thrown back to the top of the page when what
// they were on is swapped for something else.
describe('YouTubeEmbed: focus when what is shown changes', () => {
  const settle = async () => {
    for (let i = 0; i < 3; i++) await nextTick();
  };
  const goOffline = async () => {
    setOnLine(false);
    window.dispatchEvent(new Event('offline'));
    await settle();
  };

  it('moves the focus to the offline card when the focused poster gives way to it, and back to the poster', async () => {
    const wrapper = mountEmbed();
    (wrapper.get('button').element as HTMLElement).focus();
    await goOffline();
    const card = wrapper.get('.youtube-embed__offline');
    expect(card.attributes('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(card.element);

    setOnLine(true);
    window.dispatchEvent(new Event('online'));
    await settle();
    expect(document.activeElement).toBe(wrapper.get('button').element);
  });

  it('moves the focus to the new poster when the focused player is given another video', async () => {
    const wrapper = mountEmbed();
    await wrapper.get('button').trigger('click');
    await settle();
    expect(document.activeElement).toBe(wrapper.get('iframe').element);
    await wrapper.setProps({ videoId: 'a-b_C1d2E3f', title: 'How Sales works' });
    await settle();
    expect(document.activeElement).toBe(wrapper.get('button').element);
  });

  it('leaves the focus alone when what was swapped did not have it', async () => {
    const elsewhere = document.createElement('button');
    document.body.append(elsewhere);
    const wrapper = mountEmbed();
    elsewhere.focus();
    await goOffline();
    expect(document.activeElement).toBe(elsewhere);

    setOnLine(true);
    window.dispatchEvent(new Event('online'));
    await settle();
    await wrapper.get('button').trigger('click');
    await settle();
    elsewhere.focus();
    await wrapper.setProps({ videoId: 'a-b_C1d2E3f' });
    await settle();
    expect(document.activeElement).toBe(elsewhere);
    elsewhere.remove();
  });
});

describe('YouTubeEmbed: layout', () => {
  const css = componentCss(SFC);

  it('is a 16:9 frame of the full width, rounded, for the poster, the player and the offline card alike', () => {
    const frame = blocks(css, '.youtube-embed__frame').join(';');
    expect(frame).toMatch(/width:\s*100%/);
    expect(frame).toMatch(/aspect-ratio:\s*16\s*\/\s*9/);
    expect(frame).toMatch(/border-radius:\s*var\(--youtube-embed-radius\)/);
    expect(blocks(css, '.youtube-embed').join(';')).toMatch(/--youtube-embed-radius:\s*var\(--ep-radius-lg,/);
  });

  it('shows a visible focus ring on the poster, and a play button of at least 44px', () => {
    expect(blocks(css, '.youtube-embed__poster:focus-visible').join(';')).toMatch(/outline:\s*2px solid/);
    const play = blocks(css, '.youtube-embed__play').join(';');
    const size = Number(/width:\s*(\d+)px/.exec(play)?.[1]);
    expect(size).toBeGreaterThanOrEqual(44);
  });

  it('does not animate the press when the person asks for reduced motion', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[^@]*\.youtube-embed__poster[^}]*transition:\s*none/);
  });
});

describe('YouTubeEmbed: entry points', () => {
  it('is exported from its folder, @erplora/ui/components and the package root', () => {
    expect(entry.YouTubeEmbed).toBe(YouTubeEmbed);
    expect((components as Record<string, unknown>).YouTubeEmbed).toBe(YouTubeEmbed);
    expect((root as Record<string, unknown>).YouTubeEmbed).toBe(YouTubeEmbed);
  });
});
