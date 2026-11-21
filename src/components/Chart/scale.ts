// The arithmetic of the charts, kept out of the components so the bars, the lines and the figure card's sparkline
// share it. The value axis always holds zero, so a bar's length is its value, and steps on round numbers (1, 2, 2.5
// or 5 times a power of ten), as spreadsheets and the usual chart libraries do.

export interface Scale {
  readonly min: number;
  readonly max: number;
  readonly ticks: readonly number[];
}

export type Point = readonly [x: number, y: number];

/** The box of a sparkline: as wide as the card, a short height, and room above and below for the stroke. */
const SPARK_WIDTH = 100;
const SPARK_HEIGHT = 32;
const SPARK_PAD = 2;

/** Rounds away the float noise of decimal steps (0.1 + 0.2), so ticks and coordinates compare and print cleanly. */
const tidy = (value: number, digits = 12): number => Number(value.toPrecision(digits));

const round2 = (value: number): number => Math.round(value * 100) / 100;

function niceStep(rough: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const residual = tidy(rough / magnitude);
  const factor = [1, 2, 2.5, 5].find((nice) => residual <= nice) ?? 10;
  return tidy(factor * magnitude);
}

/** A scale from zero (or the lowest value, when it is below zero) to a round number at or above the highest value,
 *  in about `steps` round steps. Missing values are left out; with no value, or only zeros, it runs from 0 to 1. */
export function niceScale(values: readonly (number | null)[], steps = 4): Scale {
  const present = values.filter((value): value is number => value !== null && Number.isFinite(value));
  const low = Math.min(0, ...present);
  const high = Math.max(0, ...present);
  if (high === low) return { min: 0, max: 1, ticks: [0, 1] };
  const step = niceStep((high - low) / steps);
  const first = Math.floor(tidy(low / step));
  const last = Math.ceil(tidy(high / step));
  const ticks = Array.from({ length: last - first + 1 }, (_, index) => tidy((first + index) * step));
  return { min: ticks[0], max: ticks[ticks.length - 1], ticks };
}

/** Where `value` sits on `scale`: 0 at its bottom, 1 at its top. */
export const position = (value: number, scale: Scale): number => tidy((value - scale.min) / (scale.max - scale.min));

/** A bar of `value` as fractions of the plot's height: it starts at the zero line, or at its own end below zero. */
export function barSpan(value: number, scale: Scale): { start: number; size: number } {
  const zero = position(0, scale);
  const end = position(value, scale);
  return { start: Math.min(zero, end), size: tidy(Math.abs(end - zero)) };
}

/** The centre of the `index`th of `count` equal bands across 100 units: where its label is centred too. */
export const bandCentre = (index: number, count: number): number => round2(((index + 0.5) / count) * 100);

/** A series as lines in a 100 × 100 box (y grows downwards, as in SVG): a missing value breaks the line, and a point
 *  left alone between two gaps is dropped, because one point draws no line. */
export function lineSegments(values: readonly (number | null)[], scale: Scale): Point[][] {
  const segments: Point[][] = [[]];
  values.forEach((value, index) => {
    if (value === null) segments.push([]);
    else segments[segments.length - 1].push([bandCentre(index, values.length), round2(100 - position(value, scale) * 100)]);
  });
  return segments.filter((segment) => segment.length > 1);
}

/** Pairs of coordinates written as the `points` of an SVG polyline or polygon. */
export const toPoints = (points: readonly Point[]): string => points.map(([x, y]) => `${x},${y}`).join(' ');

/** A sparkline's points in a 100 × 32 box, from its lowest value at the bottom to its highest at the top; a single
 *  value, or values that never change, run flat through the middle. */
export function sparkPoints(values: readonly number[]): string {
  if (values.length === 0) return '';
  const low = Math.min(...values);
  const span = Math.max(...values) - low;
  const middle = SPARK_HEIGHT / 2;
  const y = (value: number): number =>
    span > 0 ? round2(SPARK_PAD + (1 - (value - low) / span) * (SPARK_HEIGHT - 2 * SPARK_PAD)) : middle;
  if (values.length === 1) return toPoints([[0, middle], [SPARK_WIDTH, middle]]);
  return toPoints(values.map((value, index) => [round2((index / (values.length - 1)) * SPARK_WIDTH), y(value)]));
}
