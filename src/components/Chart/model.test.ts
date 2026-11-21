// What the bar and the line chart draw of their series: at most six, each with its colour of data and its own shape,
// and whether there is anything to draw at all.
import { describe, expect, it } from 'vitest';

import { drawnSeries, hasValues, percent } from './model';

const series = (count: number) => Array.from({ length: count }, (_, index) => ({ label: `S${index + 1}`, values: [index] }));

describe('drawnSeries', () => {
  it('gives each series its colour in order, unless it asks for one, and a shape of its kind of mark', () => {
    const drawn = drawnSeries([...series(2), { label: 'Target', values: [1], tone: 6 as const }], 'line');
    expect(drawn.map(({ label, tone, pattern }) => [label, tone, pattern])).toEqual([
      ['S1', 1, 'solid'],
      ['S2', 2, 'dashed'],
      ['Target', 6, 'dotted'],
    ]);
    expect(drawnSeries(series(3), 'bar').map(({ pattern }) => pattern)).toEqual(['solid', 'outline', 'dashed']);
  });

  it('draws six series at most: more are grouped by the page first', () => {
    expect(drawnSeries(series(8), 'bar')).toHaveLength(6);
  });
});

describe('hasValues', () => {
  it('is true only with a label and at least one value', () => {
    expect(hasValues(['Mon'], [{ label: 'S', values: [0] }])).toBe(true);
    expect(hasValues(['Mon'], [{ label: 'S', values: [null] }])).toBe(false);
    expect(hasValues([], [{ label: 'S', values: [3] }])).toBe(false);
    expect(hasValues(['Mon'], [])).toBe(false);
  });
});

describe('percent', () => {
  it('writes a fraction as a CSS percentage with two decimals at most', () => {
    expect([percent(0.5), percent(1 / 3), percent(0)]).toEqual(['50%', '33.33%', '0%']);
  });
});
