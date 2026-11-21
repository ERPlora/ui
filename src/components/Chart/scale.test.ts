// The geometry of the charts: the round scale of the value axis, where a bar or a point sits on it and the points of a
// sparkline. Pure numbers, so the bars, the lines and the figure card's sparkline draw from the same arithmetic.
import { describe, expect, it } from 'vitest';

import { bandCentre, barSpan, lineSegments, niceScale, position, sparkPoints, toPoints } from './scale';

describe('niceScale', () => {
  it.each([
    { values: [40, 150, 235, 280], ticks: [0, 100, 200, 300] },
    { values: [3, 7], ticks: [0, 2, 4, 6, 8] },
    { values: [128460, 70000], ticks: [0, 50000, 100000, 150000] },
    { values: [0.3, 0.8], ticks: [0, 0.2, 0.4, 0.6, 0.8] },
  ])('runs from zero to a round number at or above the largest of $values', ({ values, ticks }) => {
    const scale = niceScale(values);
    expect(scale.ticks).toEqual(ticks);
    expect(scale.min).toBe(0);
    expect(scale.max).toBe(ticks.at(-1));
  });

  it('goes below zero when a value does, on the same round steps', () => {
    expect(niceScale([-18.4, 45]).ticks).toEqual([-20, 0, 20, 40, 60]);
  });

  it('leaves out the values that are missing', () => {
    expect(niceScale([null, 12, null]).ticks).toEqual([0, 5, 10, 15]);
  });

  it('still has a scale when every value is zero, or there is none', () => {
    expect(niceScale([0, 0]).ticks).toEqual([0, 1]);
    expect(niceScale([]).ticks).toEqual([0, 1]);
  });
});

describe('position and barSpan', () => {
  const scale = niceScale([-20, 60]);

  it('puts a value between the bottom (0) and the top (1) of the scale', () => {
    expect(position(-20, scale)).toBe(0);
    expect(position(0, scale)).toBe(0.25);
    expect(position(60, scale)).toBe(1);
  });

  it('draws a bar from the zero line, upwards for a positive value and downwards for a negative one', () => {
    expect(barSpan(40, scale)).toEqual({ start: 0.25, size: 0.5 });
    expect(barSpan(-20, scale)).toEqual({ start: 0, size: 0.25 });
  });
});

describe('bandCentre', () => {
  it('puts each of n points in the middle of its band, where its label is centred', () => {
    expect([0, 1, 2, 3].map((index) => bandCentre(index, 4))).toEqual([12.5, 37.5, 62.5, 87.5]);
    expect(bandCentre(0, 1)).toBe(50);
  });
});

describe('lineSegments', () => {
  const scale = niceScale([0, 100]);

  it('places each value in a 100 × 100 box, the top of the scale at the top', () => {
    expect(lineSegments([0, 50, 100], scale)).toEqual([
      [
        [16.67, 100],
        [50, 50],
        [83.33, 0],
      ],
    ]);
  });

  it('breaks the line where a value is missing, and drops a point left alone', () => {
    expect(lineSegments([10, 20, null, 30, null, 40, 60], scale).map((segment) => segment.length)).toEqual([2, 2]);
  });
});

describe('sparkPoints and toPoints', () => {
  it('stretches a sparkline from its lowest value at the bottom to its highest at the top of a 100 × 32 box', () => {
    expect(sparkPoints([5, 15, 10])).toBe('0,30 50,2 100,16');
  });

  it('draws a flat line through the middle for a single value or values that never change', () => {
    expect(sparkPoints([7])).toBe('0,16 100,16');
    expect(sparkPoints([3, 3, 3])).toBe('0,16 50,16 100,16');
  });

  it('draws nothing without values', () => {
    expect(sparkPoints([])).toBe('');
  });

  it('writes pairs of coordinates as SVG points', () => {
    expect(
      toPoints([
        [1, 2],
        [3.5, 4],
      ]),
    ).toBe('1,2 3.5,4');
  });
});
