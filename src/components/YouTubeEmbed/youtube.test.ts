import { describe, expect, it } from 'vitest';

import { youtubeEmbedSrc } from './youtube';

describe('youtubeEmbedSrc', () => {
  it('builds the privacy-enhanced embed URL that plays inline, without fullscreen or suggestions from other channels', () => {
    expect(youtubeEmbedSrc('dQw4w9WgXcQ')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&fs=0&rel=0&playsinline=1',
    );
    expect(youtubeEmbedSrc('a-b_C1d2E3f')).toBe(
      'https://www.youtube-nocookie.com/embed/a-b_C1d2E3f?autoplay=1&fs=0&rel=0&playsinline=1',
    );
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
