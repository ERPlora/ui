/** Reconnection delay for the live stream: base × 2^attempt, capped, minus up to 20% jitter. */

export const DEFAULT_RETRY_MS = 3000;
export const MAX_BACKOFF_MS = 30000;
const JITTER_RATIO = 0.2;

export function backoffDelay(attempt: number, baseMs: number, random: () => number = Math.random): number {
  const base = baseMs > 0 ? baseMs : DEFAULT_RETRY_MS;
  const capped = Math.min(MAX_BACKOFF_MS, base * 2 ** Math.max(0, attempt));
  return Math.round(capped * (1 - JITTER_RATIO * random()));
}
