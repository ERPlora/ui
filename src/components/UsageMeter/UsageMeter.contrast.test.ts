// Contrast of UsageMeter and UsageCounter (working rules §2.4): the filled part of the bar is the
// information, so it must reach 3:1 (WCAG 1.4.11, non-text) against the card it sits on and against
// the empty track next to it; the texts (label, amount, percentage, hint; the counter's label, number
// and hint) must reach 4.5:1. On every surface, light and dark, with the shell's theme and every
// optional palette, read from the real stylesheets.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  blocks,
  colour,
  componentCss,
  contrast,
  declaration,
  mix,
  percent,
  type Rgb,
  surfacesOf,
  type Theme,
  themes,
  vars,
  type Vars,
} from '../__tests__/themeContrast';

const HERE = dirname(fileURLToPath(import.meta.url));
const meterCss = componentCss(join(HERE, 'UsageMeter.vue'));
const counterCss = componentCss(join(HERE, 'UsageCounter.vue'));

const TONES = ['success', 'warning', 'danger'] as const;
const BASE = vars(meterCss, '.usage-meter');
const toneVars = (tone: string): Vars => ({ ...BASE, ...vars(meterCss, `.usage-meter[data-tone='${tone}']`) });

/** `color-mix(in srgb, <colour> N%, transparent)` over `surface`. */
function overSurface(value: string, scope: Vars, surface: Rgb): Rgb {
  const m = /^color-mix\(in srgb, (.+) (\d+(?:\.\d+)?%), transparent\)$/.exec(value);
  if (!m) throw new Error(`not a wash over transparent: ${value}`);
  return mix(colour(m[1], scope), surface, percent(m[2]));
}

const required = (css: string, selector: string, property: string): string => {
  const value = declaration(css, selector, property);
  if (!value) throw new Error(`${selector} has no ${property}`);
  return value;
};

function fill(theme: Theme, tone: string): Rgb {
  const scope = { ...theme.scope, ...toneVars(tone) };
  const value = theme.dark
    ? required(meterCss, ':root.ion-palette-dark .usage-meter__fill', 'background')
    : required(meterCss, '.usage-meter__fill', 'background');
  return colour(value, scope);
}

describe('UsageMeter colours', () => {
  it('the fill is its tone, darkened in light and lightened in dark by each tone’s own amount', () => {
    expect(blocks(meterCss, '.usage-meter__fill').join(';')).toMatch(
      /background:\s*color-mix\(in srgb, var\(--usage-meter-tone\) var\(--usage-meter-shade\), black\)/,
    );
    expect(blocks(meterCss, ':root.ion-palette-dark .usage-meter__fill').join(';')).toMatch(
      /background:\s*color-mix\(in srgb, var\(--usage-meter-tone\) var\(--usage-meter-shade-dark\), white\)/,
    );
  });

  it('every tone reads the Ionic colour of its meaning, through our --ep-* token', () => {
    for (const tone of TONES) {
      expect(toneVars(tone)['--usage-meter-tone'], tone).toMatch(
        new RegExp(`^var\\(--ep-${tone}, var\\(--ion-color-${tone}, #[0-9a-f]{6}\\)\\)$`, 'i'),
      );
    }
  });

  for (const theme of themes()) {
    it(`the fill reaches 3:1 against the surface and the empty track, every tone — ${theme.name}`, () => {
      const failures: string[] = [];
      for (const tone of TONES) {
        const filled = fill(theme, tone);
        for (const surface of surfacesOf(theme)) {
          const ground = colour(`var(${surface})`, theme.scope);
          const track = overSurface(required(meterCss, '.usage-meter__track', 'background'), theme.scope, ground);
          const onSurface = contrast(filled, ground);
          const onTrack = contrast(filled, track);
          if (onSurface < 3) failures.push(`${tone} on ${surface}: ${onSurface.toFixed(2)}:1`);
          if (onTrack < 3) failures.push(`${tone} on its track over ${surface}: ${onTrack.toFixed(2)}:1`);
        }
      }
      expect(failures, failures.join('; ')).toEqual([]);
    });

    it(`the texts reach AA (4.5:1) on every surface — ${theme.name}`, () => {
      const failures: string[] = [];
      const parts = ['.usage-meter__label', '.usage-meter__value', '.usage-meter__percent', '.usage-meter__hint'];
      for (const part of parts) {
        const ink = colour(required(meterCss, part, 'color'), theme.scope);
        for (const surface of surfacesOf(theme)) {
          const ratio = contrast(ink, colour(`var(${surface})`, theme.scope));
          if (ratio < 4.5) failures.push(`${part} on ${surface}: ${ratio.toFixed(2)}:1`);
        }
      }
      expect(failures, failures.join('; ')).toEqual([]);
    });

    it(`the counter’s texts reach AA (4.5:1) on its own background — ${theme.name}`, () => {
      const failures: string[] = [];
      const ground = colour(required(counterCss, '.usage-counter', 'background'), theme.scope);
      for (const part of ['.usage-counter__label', '.usage-counter__value', '.usage-counter__hint']) {
        const ratio = contrast(colour(required(counterCss, part, 'color'), theme.scope), ground);
        if (ratio < 4.5) failures.push(`${part}: ${ratio.toFixed(2)}:1`);
      }
      expect(failures, failures.join('; ')).toEqual([]);
    });
  }
});
