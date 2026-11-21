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
