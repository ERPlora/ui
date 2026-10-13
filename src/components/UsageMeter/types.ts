// Public types of UsageMeter and UsageCounter.

/** Colour of the bar, by how full it is: fine (under 70 %), getting full (70–90 %), full (90 % on). */
export type UsageMeterTone = 'success' | 'warning' | 'danger';

/** `md` is the meter of the mockups (8px bar); `sm` is thinner, for dense places. */
export type UsageMeterSize = 'sm' | 'md';

/** What `usagePercent` measures: an amount over its limit, or a percentage given as such. */
export interface UsageAmount {
  value?: number | null;
  max?: number | null;
  percent?: number | null;
}
