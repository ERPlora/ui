// The labels along the bottom of a chart: with more than fit (the 24 hours of a day on a phone), every Nth is shown,
// the way chart libraries skip labels, and each one shown keeps its whole text, never cut and never over its neighbour.
import { describe, expect, it } from 'vitest';

import { placeLabels } from './axisLabels';

/** «00:00» to «23:00» at the axis' 12 px are about 31 px wide each. */
const HOURS = Array.from({ length: 24 }, () => 31);
const GAP = 8;

function check(width: number, widths: readonly number[]) {
  const places = placeLabels(width, widths);
  const shown = places.filter((place) => place.shown);
  const edges = shown.map(({ index, centre }) => [centre - widths[index] / 2, centre + widths[index] / 2]);
  return { places, shown: shown.map(({ index }) => index), edges };
}

describe('placeLabels', () => {
  it.each([
    // The chart's width on a 375 px phone, on an 820 px tablet with the panel full width, and on a desktop.
    { width: 337, step: 4 },
    { width: 782, step: 2 },
    { width: 1402, step: 1 },
  ])('shows every $step label of 24 hours in $width px, each whole, inside the axis and apart from the next', ({ width, step }) => {
    const { places, shown, edges } = check(width, HOURS);
    expect(places).toHaveLength(24);
    expect(shown).toEqual(Array.from({ length: Math.ceil(24 / step) }, (_, n) => n * step));
    for (const [left, right] of edges) {
      expect(left).toBeGreaterThanOrEqual(0);
      expect(right).toBeLessThanOrEqual(width);
    }
    edges.slice(1).forEach(([left], n) => expect(left - edges[n][1]).toBeGreaterThanOrEqual(GAP));
  });

  it('centres each label under its band, moved inwards only as far as it takes to stay inside the axis', () => {
    const { places } = check(300, [20, 20, 20]);
    expect(places.map(({ centre }) => centre)).toEqual([50, 150, 250]);
    const wide = check(90, [40, 10, 40]).places.map(({ centre }) => centre);
    expect(wide).toEqual([20, 45, 70]);
  });

  it('skips one more when moving a label inwards would put it over the next', () => {
    expect(check(337, HOURS).shown).not.toContain(3);
  });

  it('places the skipped labels inside the axis too, so a hidden one never widens the page', () => {
    for (const { index, centre } of check(337, HOURS).places) {
      expect(centre - HOURS[index] / 2, `label ${index}`).toBeGreaterThanOrEqual(0);
      expect(centre + HOURS[index] / 2, `label ${index}`).toBeLessThanOrEqual(337);
    }
  });

  it('places nothing before the axis has a width', () => {
    expect(placeLabels(0, HOURS)).toEqual([]);
    expect(placeLabels(300, [])).toEqual([]);
  });
});
