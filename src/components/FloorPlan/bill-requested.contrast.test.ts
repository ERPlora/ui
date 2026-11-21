// An occupied table whose bill was requested is painted in a colour of its own: on the plan the whole table and, through
// TableGlyph, its seats and its arc; on the phone the number, the status and the edge of its card. Read from the real
// stylesheets (happy-dom paints nothing), in light and dark, with the shell's theme, its AA setting and every palette.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { colour, componentCss, contrast, plain, themes, vars } from '../__tests__/themeContrast';

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
    it(`is none of the other states' colours nor the timer's — ${theme.name}`, () => {
      const own = colour(tableColour, theme.scope).join();
      const clashes = Object.entries(TAKEN).filter(([, value]) => colour(value ?? '', theme.scope).join() === own);
      expect(clashes.map(([name]) => name)).toEqual([]);
    });

    it(`reads AA (4.5:1) under the table's number and time, and as text on the card — ${theme.name}`, () => {
      const on = colour(tableColour, theme.scope);
      const surface = colour('var(--ion-card-background)', theme.scope);
      expect(contrast(colour(tableInk, theme.scope), on)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colour(cardBill['--card-accent'] ?? '', theme.scope), surface)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
