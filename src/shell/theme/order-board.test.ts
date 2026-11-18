// CSS is not applied under happy-dom, so these read the rules of order-board.css themselves.
import { describe, expect, it } from 'vitest';

import { LITERAL_COLOUR, outweighs, rules, selectorsOf, specificity, themeSheet, valueOf } from './__tests__/sheetRules';

const css = themeSheet('order-board.css');

const BOARD = '.ep-order-board';
const BAR = '.ep-order-board-bar';
const TOTALS = '.ep-order-board-totals';
const SKELETON = '.ep-order-board-skeleton';

describe('order-board.css: the board around the order tickets', () => {
  it('styles nothing but its own blocks', () => {
    const selectors = selectorsOf(css);
    expect(selectors.length).toBeGreaterThan(15);
    expect(selectors.filter((selector) => !selector.startsWith(BOARD))).toEqual([]);
  });

  it('lays the tickets out in columns of at least 19rem, one column on a phone, and their loading cards the same', () => {
    expect(valueOf(css, BOARD, 'display')).toBe('grid');
    expect(valueOf(css, BOARD, 'grid-template-columns')).toBe('repeat(auto-fill, minmax(min(100%, 19rem), 1fr))');
  });

  it('keeps the bar in sight while the board scrolls, with tabs a finger can take', () => {
    expect(valueOf(css, BAR, 'position')).toBe('sticky');
    expect(valueOf(css, BAR, 'top')).toBe('0');
    expect(valueOf(css, BAR, 'container-type')).toBe('inline-size');
    expect(valueOf(css, `${BAR} ion-segment-button`, 'min-height')).toBe('var(--ep-touch-min)');
    expect(valueOf(css, `${BAR} .ep-order-board-bar__fullscreen`, 'min-height')).toBe('var(--ep-touch-min)');
    expect(css).toMatch(/@container \(max-width: 26rem\) \{[^@]*\.ep-order-board-bar ion-segment-button/);
  });

  it('right-aligns the quantities of the totals over the alignment of their column', () => {
    const num = `${TOTALS} .ep-order-board-totals__num`;
    expect(valueOf(css, num, 'text-align')).toBe('right');
    const cells = rules(css).find((rule) => rule.selectors.includes(`${TOTALS} td`));
    expect(cells?.body).toContain('text-align: left');
    for (const cell of cells?.selectors ?? []) expect(outweighs(specificity(num), specificity(cell)), cell).toBe(true);
  });

  it('spaces the grey lines of a loading card by weight, never by !important', () => {
    const dish = `${SKELETON} .ep-order-board-skeleton__dish`;
    expect(valueOf(css, dish, 'margin-top')).toBe('1.25rem');
    const reset = rules(css).find((rule) => rule.selectors.some((s) => s.endsWith('ion-skeleton-text')));
    expect(reset?.body).toContain('margin: 0');
    for (const selector of reset?.selectors ?? []) expect(outweighs(specificity(dish), specificity(selector)), selector).toBe(true);
    expect(css).not.toContain('!important');
  });

  it('takes its colours from the theme', () => {
    expect(css).not.toMatch(LITERAL_COLOUR);
    expect(css).not.toMatch(/glass|backdrop-filter/);
  });
});
