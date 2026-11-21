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
