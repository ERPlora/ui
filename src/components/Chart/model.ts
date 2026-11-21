import { barSpan, lineSegments, position, type Scale, toPoints } from './scale';
import type { ChartSeries, ChartTone } from './types';

export type ChartMark = 'bar' | 'line';

/** A series as a chart draws it: its colour settled and a shape of its own, so colour is never the only difference. */
export interface DrawnSeries extends ChartSeries {
  tone: ChartTone;
  pattern: string;
}

/** Six colours of data, so six series at most; a page with more groups them first («Other»), as the data rules say. */
const MAX_SERIES = 6;

/** The second channel after colour: bars are filled, outlined or dashed; lines are solid, dashed or dotted. */
const PATTERNS: Record<ChartMark, readonly string[]> = {
  bar: ['solid', 'outline', 'dashed'],
  line: ['solid', 'dashed', 'dotted'],
};

export function drawnSeries(series: readonly ChartSeries[], mark: ChartMark): DrawnSeries[] {
  const patterns = PATTERNS[mark];
  return series.slice(0, MAX_SERIES).map((item, index) => ({
    ...item,
    tone: item.tone ?? ((index + 1) as ChartTone),
    pattern: patterns[index % patterns.length],
  }));
}

/** Whether there is anything to draw: a label and at least one value. */
export const hasValues = (labels: readonly string[], series: readonly ChartSeries[]): boolean =>
  labels.length > 0 && series.some((item) => item.values.some((value) => value !== null));

/** A fraction written as a CSS percentage, for the bars' sizes. */
export const percent = (fraction: number): string => `${Math.round(fraction * 10000) / 100}%`;

/** Each label's bars, one per series in the series' order; a missing value keeps its place in the group with no bar. */
export function barGroups(labels: readonly string[], series: readonly DrawnSeries[], scale: Scale) {
  return labels.map((_label, index) =>
    series.map((item) => {
      const value = item.values[index] ?? null;
      if (value === null) return { item, bar: undefined };
      const span = barSpan(value, scale);
      const style = { bottom: percent(span.start), height: percent(span.size) };
      return { item, bar: { sign: value < 0 ? 'negative' : 'positive', style } };
    }),
  );
}

/** Every line to draw: each series broken where a value is missing, as SVG points in a 100 × 100 box. */
export const linePaths = (series: readonly DrawnSeries[], scale: Scale) =>
  series.flatMap((item, index) =>
    lineSegments(item.values, scale).map((segment, part) => ({ key: `${index}-${part}`, item, segment, points: toPoints(segment) })),
  );

/** The shade under the first series: each of its lines closed down to the zero line. */
export function lineShades(series: readonly DrawnSeries[], scale: Scale) {
  const first = series.slice(0, 1);
  const zero = Math.round((1 - position(0, scale)) * 10000) / 100;
  return linePaths(first, scale).map(({ key, item, segment }) => ({
    key,
    item,
    points: toPoints([...segment, [segment[segment.length - 1][0], zero], [segment[0][0], zero]]),
  }));
}
