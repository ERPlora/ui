import type { StatCardTone } from '../StatCard/types';

/** One of the six colours of data, `--ep-data-1` to `--ep-data-6`: the figure card's tones, so a measure keeps its
 *  colour from the card to the chart. */
export type ChartTone = StatCardTone;

/** One line or one set of bars: its name, a value per label (none where it is missing) and its colour. Without a tone
 *  the first series is 1, the second 2 and so on; a chart draws six at most, and more are grouped by the page first. */
export interface ChartSeries {
  label: string;
  values: readonly (number | null)[];
  tone?: ChartTone;
}

/** The props shared by the bar and the line chart. */
export interface ChartProps {
  /** What each value is about, along the bottom (days, hours). */
  labels: readonly string[];
  series: readonly ChartSeries[];
  /** What the chart shows, in words: its caption on the screen and the name of its table for a screen reader. */
  description: string;
  /** Writes a value of the axis and of the table (an amount with `formatMoney`); by default, a number in the
   *  person's language. */
  format?: (value: number) => string;
  loading?: boolean;
  /** The values could not be loaded: the chart says so and offers Retry. */
  error?: boolean;
  /** The page's own words for no data; by default «No data for this period». */
  emptyLabel?: string;
  testid?: string;
}

/** A row of a bar list: its name, its value (none when it has no value), that value written by the page and its
 *  colour; without a tone, the list's. */
export interface BarListItem {
  label: string;
  value: number | null;
  text: string;
  tone?: ChartTone;
}
