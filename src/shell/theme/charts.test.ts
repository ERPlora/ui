// CSS is not applied under happy-dom, so these read the rules of charts.css themselves: the look of the bar chart, the
// line chart and the bar list, and the contrast of their marks on the card that holds them.
import { describe, expect, it } from 'vitest';

import { colour, contrast, themes } from '../../components/__tests__/themeContrast';
import { atRuleBody, contentCardFaults, pixels, rulesFor, selectorsOf, themeSheet, valueOf } from './__tests__/sheetRules';

const css = themeSheet('charts.css');
/** The sheet without its `@media` and `@container` blocks: the look every person gets on a wide screen. */
const base = css.replace(/@(?:media|container)[^{]*\{[\s\S]*?\}\s*\}/g, '');
const CHART = '.ep-chart';
const SERIES = [1, 2, 3, 4, 5, 6] as const;
const at = (part: string) => `${CHART} .ep-chart__${part}`;

describe('charts.css: the look of the charts', () => {
  it('styles nothing but the charts', () => {
    const selectors = selectorsOf(css);
    expect(selectors.length).toBeGreaterThan(20);
    expect(selectors.filter((selector) => !selector.startsWith(CHART))).toEqual([]);
  });

  it('sits on the card that holds it: no glass, and colours only from the theme', () => {
    expect(contentCardFaults(css)).toEqual([]);
  });

  it('paints series 1 unless a mark says another tone, and each tone reads its own colour of data', () => {
    expect(valueOf(css, CHART, '--chart-tone')).toBe('var(--ep-data-1)');
    for (const series of SERIES) {
      expect(valueOf(css, `${CHART} [data-tone='${series}']`, '--chart-tone'), `tone ${series}`).toBe(`var(--ep-data-${series})`);
    }
  });

  it('writes the axis, the labels, the legend and the caption in the theme’s muted text, never in a series colour', () => {
    for (const part of ['axis', 'labels', 'legend', 'caption', 'empty']) {
      expect(valueOf(css, at(part), 'color'), part).toBe('var(--ep-text-muted)');
    }
    expect(valueOf(css, at('value'), 'color')).toBe('var(--ion-text-color)');
    expect(valueOf(css, at('rule'), 'border-top')).toBe('1px solid var(--ion-border-color)');
  });

  it('draws bars in their tone with rounded ends away from zero: the first series filled, then outlined, then dashed', () => {
    expect(valueOf(base, at('bar'), 'background')).toBe('var(--chart-tone)');
    expect(valueOf(css, at('bar'), 'border-radius')).toBe('4px 4px 0 0');
    expect(valueOf(css, `${at('bar')}[data-sign='negative']`, 'border-radius')).toBe('0 0 4px 4px');
    expect(valueOf(css, `${at('bar')}[data-pattern='outline']`, 'border')).toBe('2px solid var(--chart-tone)');
    expect(valueOf(css, `${at('bar')}[data-pattern='dashed']`, 'border')).toBe('2px dashed var(--chart-tone)');
    expect(valueOf(css, at('group'), 'gap')).toBe('2px');
  });

  it('draws lines 2 px wide in their tone, each further series with its own dash, and a light shade under the first', () => {
    expect(valueOf(base, at('line'), 'stroke')).toBe('var(--chart-tone)');
    expect(valueOf(css, at('line'), 'stroke-width')).toBe('2');
    expect(valueOf(css, at('line'), 'fill')).toBe('none');
    const dashed = valueOf(css, `${at('line')}[data-pattern='dashed']`, 'stroke-dasharray');
    const dotted = valueOf(css, `${at('line')}[data-pattern='dotted']`, 'stroke-dasharray');
    expect(dashed).toBeTruthy();
    expect(dotted).toBeTruthy();
    expect(dotted).not.toBe(dashed);
    expect(Number(valueOf(css, at('shade'), 'fill-opacity'))).toBeLessThanOrEqual(0.2);
  });

  it('draws a value with no neighbour as an 8 px dot: filled for the first series, a ring in its colour for the others', () => {
    expect(valueOf(base, at('dot'), 'position')).toBe('absolute');
    expect(valueOf(base, at('dot'), 'width')).toBe('0.5rem');
    expect(valueOf(base, at('dot'), 'height')).toBe('0.5rem');
    expect(valueOf(base, at('dot'), 'border-radius')).toBe('50%');
    expect(valueOf(base, at('dot'), 'transform')).toBe('translate(-50%, -50%)');
    expect(valueOf(base, at('dot'), 'background')).toBe('var(--chart-tone)');
    for (const pattern of ['dashed', 'dotted']) {
      const ring = `${at('dot')}[data-pattern='${pattern}']`;
      expect(valueOf(base, ring, 'border'), pattern).toBe('2px solid var(--chart-tone)');
      expect(valueOf(base, ring, 'background'), pattern).toBe('var(--ion-card-background)');
    }
    expect(valueOf(atRuleBody(css, '@media (forced-colors: active)'), at('dot'), 'background')).toBe('CanvasText');
  });

  it('gives each key of the legend the shape of its marks', () => {
    const lineKey = `${at('swatch')}[data-mark='line']`;
    expect(valueOf(css, lineKey, 'border-top')).toBe('3px solid var(--chart-tone)');
    expect(valueOf(css, `${lineKey}[data-pattern='dashed']`, 'border-top-style')).toBe('dashed');
    expect(valueOf(css, `${lineKey}[data-pattern='dotted']`, 'border-top-style')).toBe('dotted');
    expect(rulesFor(css, `${at('swatch')}[data-mark='bar'][data-pattern='outline']`)).toHaveLength(1);
    expect(rulesFor(css, `${at('swatch')}[data-mark='bar'][data-pattern='dashed']`)).toHaveLength(1);
  });

  it('lines up the bars of a list: the list sets the columns and every row follows them', () => {
    expect(valueOf(base, at('list'), 'grid-template-columns')).toMatch(/^minmax\(.+\) minmax\(.+\) auto$/);
    expect(valueOf(css, at('row'), 'grid-column')).toBe('1 / -1');
    expect(valueOf(css, at('row'), 'grid-template-columns')).toBe('subgrid');
  });

  it('fills a bar list’s rows in their tone, and a value below zero in the danger colour', () => {
    expect(valueOf(base, at('fill'), 'background')).toBe('var(--chart-tone)');
    expect(valueOf(css, `${at('fill')}[data-sign='negative']`, 'background')).toBe('var(--ion-color-danger)');
  });

  it('keeps the table of values for a screen reader only', () => {
    expect(valueOf(css, at('table'), 'position')).toBe('absolute');
    expect(valueOf(css, at('table'), 'clip-path')).toBe('inset(50%)');
    expect(valueOf(css, at('table'), 'width')).toBe('1px');
    // A table does not clip itself: the block around it does, or the hidden table widens the page on a phone.
    expect(valueOf(css, at('table'), 'overflow')).toBe('hidden');
  });

  it('keeps its Retry at least 48 px tall', () => {
    expect(valueOf(css, at('retry'), 'min-height')).toBe('var(--ep-touch-min)');
  });

  it('on a narrow chart (a phone) it lowers the plot', () => {
    const narrow = atRuleBody(css, '@container (max-width');
    expect(narrow, 'a container query of the chart itself').not.toBe('');
    expect(pixels(valueOf(narrow, at('plot'), 'grid-template-rows')?.split(' ')[0])).toBeLessThan(
      pixels(valueOf(base, at('plot'), 'grid-template-rows')?.split(' ')[0])!,
    );
  });

  it('writes each label of the bottom axis whole, centred on its place, and hides the ones the chart skips', () => {
    expect(valueOf(base, at('labels'), 'position')).toBe('relative');
    expect(valueOf(base, at('label'), 'position')).toBe('absolute');
    expect(valueOf(base, at('label'), 'transform')).toBe('translateX(-50%)');
    expect(valueOf(base, at('label'), 'white-space')).toBe('nowrap');
    expect(valueOf(css, at('label'), 'overflow')).toBeUndefined();
    expect(valueOf(css, at('label'), 'text-overflow')).toBeUndefined();
    expect(valueOf(css, `${at('label')}[data-skipped]`, 'visibility')).toBe('hidden');
    expect(css).not.toContain(':nth-child(even)');
  });

  it('stays readable in forced colours: marks in the system’s text colour', () => {
    const forced = atRuleBody(css, '@media (forced-colors: active)');
    expect(valueOf(forced, at('bar'), 'background')).toBe('CanvasText');
    expect(valueOf(forced, at('fill'), 'background')).toBe('CanvasText');
    expect(valueOf(forced, at('line'), 'stroke')).toBe('CanvasText');
  });
});

describe('charts.css: contrast of the marks', () => {
  for (const { name, scope } of themes()) {
    it(`every series reads 3:1 as a bar or a line on the card, and so does a bar below zero — ${name}`, () => {
      const card = colour('var(--ion-card-background)', scope);
      const failures = SERIES.map((series) => [series, contrast(colour(`var(--ep-data-${series})`, scope), card)] as const)
        .filter(([, ratio]) => ratio < 3)
        .map(([series, ratio]) => `series ${series}: ${ratio.toFixed(2)}:1`);
      const danger = contrast(colour('var(--ion-color-danger)', scope), card);
      if (danger < 3) failures.push(`below zero: ${danger.toFixed(2)}:1`);
      expect(failures, failures.join('; ')).toEqual([]);
    });
  }
});
