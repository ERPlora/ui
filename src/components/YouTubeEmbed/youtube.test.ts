import { describe, expect, it } from 'vitest';

import { youtubeEmbedSrc } from './youtube';

describe('youtubeEmbedSrc', () => {
  it('builds the privacy-enhanced embed URL with all of YouTube\'s controls, inline and without suggestions from other channels', () => {
    expect(youtubeEmbedSrc('dQw4w9WgXcQ')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0&playsinline=1',
    );
    expect(youtubeEmbedSrc('a-b_C1d2E3f')).toBe(
      'https://www.youtube-nocookie.com/embed/a-b_C1d2E3f?autoplay=1&rel=0&playsinline=1',
    );
  });

  it('turns the captions on in the language it is given and shows the player in it', () => {
    expect(youtubeEmbedSrc('dQw4w9WgXcQ', 'es')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0&playsinline=1'
        + '&cc_load_policy=1&cc_lang_pref=es&hl=es',
    );
    for (const language of ['en', 'pt-BR', 'es-419', 'fil']) {
      expect(youtubeEmbedSrc('dQw4w9WgXcQ', language), language).toBe(
        'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0&playsinline=1'
          + `&cc_load_policy=1&cc_lang_pref=${language}&hl=${language}`,
      );
    }
  });

  it('leaves out a language that is not a language code, so nothing else reaches the URL', () => {
    for (const language of [
      '',
      'e',
      'español',
      'es-',
      '-ES',
      'es_ES',
      'es ES',
      'es-ES-x',
      'es1',
      'es&hl=fr',
      'es#',
      '../es',
      'es\n',
    ]) {
      expect(youtubeEmbedSrc('dQw4w9WgXcQ', language), JSON.stringify(language)).toBe(
        'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0&playsinline=1',
      );
    }
  });

  it('refuses anything that is not an 11-character YouTube id, so nothing else reaches the URL', () => {
    for (const id of [
      '',
      'dQw4w9WgXc',
      'dQw4w9WgXcQQ',
      'dQw4w9WgXc/',
      'dQw4w9WgXc?',
      'dQw4w9WgXc&',
      'dQw4w9WgXc.',
      'dQw4w9WgXc ',
      ' dQw4w9WgXc',
      'dQw4w9WgXcñ',
      '../../evil1',
      'dQw4w9WgXcQ\n',
    ]) {
      expect(youtubeEmbedSrc(id), JSON.stringify(id)).toBeUndefined();
    }
  });
});
