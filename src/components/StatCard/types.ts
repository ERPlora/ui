import type { StatusPillTone } from '../StatusPill/types';

/** One of the six colours of data, `--ep-data-1` to `--ep-data-6`: the same measure keeps the same tone everywhere. */
export type StatCardTone = 1 | 2 | 3 | 4 | 5 | 6;

/** `live` paints the tone's gradient, for the main row of a summary; `soft` keeps the surface and colours the icon. */
export type StatCardVariant = 'live' | 'soft';

export type StatCardTrendDirection = 'up' | 'down' | 'flat';

/** Whether the change is good news, bad news or neither. By default up is good and down is bad. */
export type StatCardTrendTone = 'success' | 'danger' | 'neutral';

export interface StatCardTrend {
  direction: StatCardTrendDirection;
  /** What changed, in words («12.4 % more than last Tuesday»). */
  label: string;
  tone?: StatCardTrendTone;
}

/** Good, needs a look, or a problem: the three tones of a status. */
export type StatCardStatusTone = Extract<StatusPillTone, 'success' | 'warning' | 'danger'>;

/** Something about the figure apart from its value («Sold out», «Cash mismatch»): it never changes the card's tone. */
export interface StatCardStatus {
  tone: StatCardStatusTone;
  /** The status in words, which is what a screen reader reads. */
  label: string;
}
