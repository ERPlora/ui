// The poster's texts sit on its own dark surface, the caption and the offline card on the theme's: every text must
// reach WCAG AA (4.5:1) in light and dark, with the shell's theme and every optional palette, read from the stylesheets.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { colour, componentCss, contrast, mix, percent, surfacesOf, themes, vars } from '../__tests__/themeContrast';

const css = componentCss(join(dirname(fileURLToPath(import.meta.url)), 'YouTubeEmbed.vue'));
const OWN = vars(css, '.youtube-embed');
const AA = 4.5;

/** The strongest glow: the theme's primary over the poster's lighter end, at the share the poster gives it. */
const GLOW_SHARE = percent(/ (\d+%), transparent\)$/.exec(OWN['--youtube-embed-glow'] ?? '')?.[1] ?? '100%');

describe('YouTubeEmbed colours', () => {
  it('paint the poster with its own dark surface and the glow of the primary colour', () => {
    for (const name of ['--youtube-embed-from', '--youtube-embed-to', '--youtube-embed-ink', '--youtube-embed-ink-muted']) {
      expect(OWN[name], name).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(OWN['--youtube-embed-glow']).toMatch(/^color-mix\(in srgb, var\(--ion-color-primary, #[0-9a-f]{6}\) \d+%, transparent\)$/i);
  });

  for (const theme of themes()) {
    it(`every text reaches AA — ${theme.name}`, () => {
      const scope = { ...theme.scope, ...OWN };
      const failures: string[] = [];
      const check = (label: string, ink: string, ground: [number, number, number]) => {
        const ratio = contrast(colour(ink, scope), ground);
        if (ratio < AA) failures.push(`${label}: ${ratio.toFixed(2)}:1`);
      };

      const from = colour('var(--youtube-embed-from)', scope);
      const to = colour('var(--youtube-embed-to)', scope);
      const glow = mix(colour('var(--ion-color-primary)', scope), from, GLOW_SHARE);
      for (const [where, ground] of [['from', from], ['to', to], ['glow', glow]] as const) {
        check(`title on ${where}`, 'var(--youtube-embed-ink)', ground);
        check(`duration on ${where}`, 'var(--youtube-embed-ink-muted)', ground);
      }
      for (const surface of surfacesOf(theme)) {
        check(`caption on ${surface}`, 'var(--ep-text-muted)', colour(`var(${surface})`, scope));
      }
      check('offline message', 'var(--ion-text-color)', colour('var(--ion-color-light)', scope));
      expect(failures).toEqual([]);
    });
  }
});
