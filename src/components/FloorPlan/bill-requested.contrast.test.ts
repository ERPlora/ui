// An occupied table whose bill was requested is painted in a colour of its own: on the plan the whole table and, through
// TableGlyph, its seats and its arc; on the phone the number, the status and the edge of its card. Read from the real
// stylesheets (happy-dom paints nothing), in light and dark, with the shell's theme, its AA setting and every palette.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { colour, componentCss, contrast, plain, type Rgb, themes, vars } from '../__tests__/themeContrast';

const HERE = dirname(fileURLToPath(import.meta.url));
const status = plain(readFileSync(join(HERE, 'floor-status.css'), 'utf8'));
const glyph = componentCss(join(HERE, 'TableGlyph.vue'));
const card = componentCss(join(HERE, 'FloorCard.vue'));

const OCCUPIED = "[data-status='occupied']";
const bill = vars(status, `${OCCUPIED}[data-bill]`);
const tableColour = bill['--table-bg'] ?? '';
const tableInk = bill['--table-ink'] ?? vars(status, OCCUPIED)['--table-ink'] ?? '';
const cardBill = vars(card, `.floor-card${OCCUPIED}[data-bill]`);

/** The colours the plan already speaks with: each state's and the timer's amber and red. */
const TAKEN: Record<string, string | undefined> = {
  occupied: vars(status, OCCUPIED)['--table-bg'],
  available: vars(status, "[data-status='available']")['--table-ink'],
  reserved: vars(status, "[data-status='reserved']")['--table-edge'],
  blocked: vars(status, "[data-status='blocked']")['--table-edge'],
  'timer amber': vars(glyph, ".table-glyph[data-tone='warning']")['--glyph-timer'],
  'timer red': vars(glyph, ".table-glyph[data-tone='critical']")['--glyph-timer'],
};

/** Two colours at least this far apart in CIE76 (the distance in CIE L*a*b*) are told apart at a glance. */
const APART = 25;

/** CIE L*a*b* (D65) of an sRGB colour. */
function lab(rgb: Rgb): number[] {
  const [r, g, b] = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

const cie76 = (a: Rgb, b: Rgb): number => {
  const [one, other] = [lab(a), lab(b)];
  return Math.hypot(...one.map((value, index) => value - other[index]));
};

describe('the colour of a requested bill', () => {
  it('is a theme colour, the same on the plan and on the phone card', () => {
    expect(tableColour).toMatch(/^var\(--ep-[a-z0-9-]+\)$/);
    expect(cardBill['--card-accent']).toBe(tableColour);
    expect(cardBill['--card-edge']).toContain(tableColour);
  });

  it('takes the seats and the arc of the table with it, while the timer amber and red still win', () => {
    const base = vars(glyph, '.table-glyph');
    expect([base['--glyph-seat-filled'], base['--glyph-timer']]).toEqual(['var(--glyph-accent)', 'var(--glyph-accent)']);
    expect(vars(glyph, '.table-glyph[data-bill]')).toEqual({ '--glyph-accent': 'var(--table-bg)' });
    expect(Object.values(TAKEN).every(Boolean)).toBe(true);
  });

  for (const theme of themes()) {
    it(`stays apart (CIE76 ${APART} or more) from every other state's colour and the timer's — ${theme.name}`, () => {
      const own = colour(tableColour, theme.scope);
      const close = Object.entries(TAKEN)
        .map(([name, value]) => [name, cie76(own, colour(value ?? '', theme.scope))] as const)
        .filter(([, distance]) => distance < APART)
        .map(([name, distance]) => `${name}: ${distance.toFixed(1)}`);
      expect(close).toEqual([]);
    });

    it(`reads AA (4.5:1) under the table's number and time, and as text on the card — ${theme.name}`, () => {
      const on = colour(tableColour, theme.scope);
      const surface = colour('var(--ion-card-background)', theme.scope);
      expect(contrast(colour(tableInk, theme.scope), on)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colour(cardBill['--card-accent'] ?? '', theme.scope), surface)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
