import { deadlineOf } from './ordering';
import type { ActionNotice, NoticeDue, NoticeSeverity } from './types';

/** How long a countdown lasts when the notice does not say when it started: the last week before the deadline. */
export const DEFAULT_COUNTDOWN_MS = 7 * 24 * 60 * 60 * 1000;

/** What the bell shows: how many things are pending, how grave the gravest is and how its deadline goes. */
export interface BellSummary {
  readonly total: number;
  readonly topSeverity?: NoticeSeverity;
  /** The first of the order, for the text the bell shows on hover. */
  readonly mostUrgent?: ActionNotice;
  /** The countdown of the most urgent notice with a deadline, from 0 to 1; undefined when none has one. */
  readonly dueProgress?: number;
}

/** The summary of `sorted`, a list already in the order of `sortNotices`. */
export function summarize(sorted: readonly ActionNotice[], now: number): BellSummary {
  const mostUrgent = sorted[0];
  const timed = sorted.find((notice) => deadlineOf(notice) !== undefined);
  return {
    total: sorted.reduce((sum, notice) => sum + (notice.count ?? 1), 0),
    topSeverity: mostUrgent?.severity,
    mostUrgent,
    dueProgress: timed?.due ? dueProgress(timed.due, now) : undefined,
  };
}

/** How much of the countdown to `due.at` has gone by at `now`: 0 when it starts, 1 at the deadline and after. */
export function dueProgress(due: NoticeDue, now: number): number {
  const at = Date.parse(due.at);
  const from = due.from === undefined ? Number.NaN : Date.parse(due.from);
  const start = Number.isNaN(from) ? at - DEFAULT_COUNTDOWN_MS : from;
  if (now >= at) return 1;
  if (now <= start) return 0;
  return (now - start) / (at - start);
}
