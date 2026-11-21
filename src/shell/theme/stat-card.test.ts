// CSS is not applied under happy-dom, so these read the rules of stat-card.css themselves: the look of the figure card
// (StatCard) and of the row that holds several.
import { describe, expect, it } from 'vitest';

import { colour, contrast, themes } from '../../components/__tests__/themeContrast';
import { contentCardFaults, pixels, rules, rulesFor, selectorsOf, themeSheet, valueOf } from './__tests__/sheetRules';

const css = themeSheet('stat-card.css');
/** The sheet without its `@media` blocks: the look every person gets, before reduced motion or forced colours. */
const base = css.replace(/@media[^{]*\{[\s\S]*?\}\s*\}/g, '');
const CARD = '.ep-stat-card';
const GRID = '.ep-stat-grid';
const LIVE = '.ep-stat-card--live';
const LINK = '.ep-stat-card.ep-stat-card--link';
const SERIES = [1, 2, 3, 4, 5, 6] as const;

/** The custom property `name` set by the rules with exactly `selector`. */
const custom = (selector: string, name: string): string | undefined => valueOf(css, selector, name);

/** The body of each `@container (max-width: <n>rem)` rule for the cards of a row, by its width in rem. */
function rowBreakpoints(): Map<number, string> {
  const found = [...css.matchAll(/@container \(max-width: ([\d.]+)rem\)\s*\{\s*\.ep-stat-grid > \*\s*\{([^}]*)\}/g)];
  return new Map(found.map((m) => [Number(m[1]), m[2]]));
}

describe('stat-card.css: the look of a figure card', () => {
  it('styles nothing but the card and its row', () => {
    const selectors = selectorsOf(css);
    expect(selectors.length).toBeGreaterThan(20);
    expect(selectors.filter((selector) => !selector.startsWith(CARD) && !selector.startsWith(GRID))).toEqual([]);
  });

  it('is an opaque content card: no glass, and colours only from the theme', () => {
    expect(contentCardFaults(css)).toEqual([]);
  });

  it('paints series 1 unless the card says another tone, and each tone reads its own data colour and gradient', () => {
    expect(custom(CARD, '--stat-card-tone')).toBe('var(--ep-data-1)');
    expect(custom(CARD, '--stat-card-gradient')).toBe('var(--ep-data-1-gradient)');
    for (const series of SERIES) {
      const tone = `${CARD}[data-tone='${series}']`;
      expect(custom(tone, '--stat-card-tone'), tone).toBe(`var(--ep-data-${series})`);
      expect(custom(tone, '--stat-card-gradient'), tone).toBe(`var(--ep-data-${series}-gradient)`);
    }
  });

  it('the lively card is its tone’s gradient with every text and icon in the colour made for it', () => {
    const live = `${CARD}${LIVE}`;
    expect(valueOf(base, live, 'background')).toBe('var(--stat-card-gradient)');
    expect(valueOf(base, live, 'color')).toBe('var(--ep-data-on-gradient)');
    for (const part of ['__icon', '__note', '__chevron']) {
      expect(valueOf(css, `${LIVE} .ep-stat-card${part}`, 'color'), part).toBe('var(--ep-data-on-gradient)');
    }
    expect(valueOf(css, `${LIVE} .ep-stat-card__trend[data-trend]`, 'color')).toBe('var(--ep-data-on-gradient)');
  });

  it('the soft card keeps the surface and writes its trend in the theme’s AA text colours', () => {
    expect(valueOf(css, `${CARD} .ep-stat-card__note`, 'color')).toBe('var(--ep-text-muted)');
    expect(valueOf(css, `${CARD} .ep-stat-card__trend[data-trend='success']`, 'color')).toBe('var(--ep-success-text)');
    expect(valueOf(css, `${CARD} .ep-stat-card__trend[data-trend='danger']`, 'color')).toBe('var(--ep-danger-text)');
    expect(valueOf(css, `${CARD} .ep-stat-card__trend[data-trend='neutral']`, 'color')).toBe('var(--ep-text-muted)');
    expect(valueOf(css, `${CARD} .ep-stat-card__error`, 'color')).toBe('var(--ep-danger-text)');
  });

  for (const { name, scope } of themes()) {
    it(`a soft card’s icon reads 3:1 on its tinted tile, every tone — ${name}`, () => {
      const failures: string[] = [];
      for (const series of SERIES) {
        const card = { ...scope, '--stat-card-tone': `var(--ep-data-${series})` };
        const ink = colour(custom(CARD, '--stat-card-ink')!, card);
        const tint = colour(custom(CARD, '--stat-card-tint')!, card);
        const ratio = contrast(ink, tint);
        if (ratio < 3) failures.push(`series ${series}: ${ratio.toFixed(2)}:1`);
      }
      expect(valueOf(css, `${CARD} .ep-stat-card__icon`, 'color')).toBe('var(--stat-card-ink)');
      expect(valueOf(css, `${CARD} .ep-stat-card__icon`, 'background')).toBe('var(--stat-card-tint)');
      expect(failures, failures.join('; ')).toEqual([]);
    });
  }

  it('in a narrow card (two a row on a phone) the label goes under the icon, so no word is split', () => {
    const narrow = [...css.matchAll(/@container \(max-width: ([\d.]+)rem\)\s*\{((?:[^{}]*\{[^}]*\})+)\s*\}/g)].find((m) =>
      m[2].includes('.ep-stat-card__heading'),
    );
    expect(narrow, 'a container query of the card itself').toBeDefined();
    // Half of a 375 px phone's row is about 165 px; a card in a row of four on a desktop is over 230 px.
    expect(Number(narrow![1]) * 16).toBeGreaterThan(165);
    expect(Number(narrow![1]) * 16).toBeLessThan(230);
    expect(valueOf(narrow![2], `${CARD} .ep-stat-card__head`, 'flex-wrap')).toBe('wrap');
    expect(valueOf(narrow![2], `${CARD} .ep-stat-card__heading`, 'flex-basis')).toBe('100%');
    expect(valueOf(narrow![2], `${CARD} .ep-stat-card__heading`, 'order')).toBe('1');
  });

  it('wraps the words of its bottom row next to their icon, never leaving the icon alone on a line', () => {
    expect(valueOf(css, `${CARD} .ep-stat-card__meta`, 'flex-wrap')).toBe('wrap');
    expect(valueOf(css, `${CARD} .ep-stat-card__text`, 'flex')).toBe('1 1 6rem');
    expect(valueOf(css, `${CARD} .ep-stat-card__text`, 'min-width')).toBe('0');
  });

  it('keeps its Retry at least 48 px tall', () => {
    expect(valueOf(css, `${CARD} .ep-stat-card__retry`, 'min-height')).toBe('var(--ep-touch-min)');
    expect(pixels(valueOf(css, CARD, 'min-height'))).toBeGreaterThanOrEqual(48);
  });

  it('rings a focused link card with the theme’s focus ring, and lifts it under the pointer', () => {
    expect(valueOf(css, `${LINK}:focus-visible`, 'box-shadow')).toContain('var(--ep-focus-ring)');
    expect(valueOf(css, `${LINK}:focus-visible`, 'outline')).toBe('none');
    expect(valueOf(base, `${LINK}:hover`, 'transform')).toBe('translateY(-2px)');
    expect(valueOf(base, `${LINK}:active`, 'transform')).toBe('scale(var(--ep-press-scale))');
  });

  it('stays still for a person who asks for reduced motion, and plain in forced colours', () => {
    const reduced = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?\})\s*\}/.exec(css)?.[1] ?? '';
    expect(rules(reduced).some((rule) => rule.selectors.includes(`${LINK}:hover`) && /transform:\s*none/.test(rule.body))).toBe(true);
    const forced = /@media \(forced-colors: active\)\s*\{([\s\S]*?\})\s*\}/.exec(css)?.[1] ?? '';
    expect(rulesFor(forced, `${CARD}${LIVE}`).map((rule) => rule.body).join(';')).toMatch(/background:\s*Canvas/);
  });
});

describe('stat-card.css: the row of figure cards', () => {
  it('is its own container with four columns', () => {
    expect(valueOf(css, GRID, 'container-type')).toBe('inline-size');
    expect(valueOf(css, GRID, 'display')).toBe('grid');
    expect(valueOf(css, GRID, 'grid-template-columns')).toBe('repeat(4, minmax(0, 1fr))');
  });

  it('holds four cards a row when wide, two on a tablet or a phone, and one only below a phone’s width', () => {
    const breakpoints = rowBreakpoints();
    expect([...breakpoints.keys()].sort((a, b) => b - a)).toHaveLength(2);
    const [tablet, narrow] = [...breakpoints.entries()].sort((a, b) => b[0] - a[0]);
    // A tablet (820 px) or a desktop with the menu open (1024 px) gives the row less than its first width.
    expect(tablet[0] * 16).toBeGreaterThan(820);
    expect(tablet[0] * 16).toBeLessThan(1100);
    expect(tablet[1]).toMatch(/grid-column:\s*span 2/);
    // A 375 px phone gives the row about 343 px: still two cards.
    expect(narrow[0] * 16).toBeLessThan(343);
    expect(narrow[1]).toMatch(/grid-column:\s*span 4/);
  });
});
