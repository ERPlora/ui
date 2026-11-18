import type { ActionNotice, NoticeSeverity } from './types';

const SEVERITY_RANK: Record<NoticeSeverity, number> = { danger: 0, warning: 1, info: 2 };

/** 0 for the gravest severity. */
export function severityRank(severity: NoticeSeverity): number {
  return SEVERITY_RANK[severity];
}

/** The instant of its due date; undefined without one, or when it is not a date. */
export function deadlineOf(notice: ActionNotice): number | undefined {
  const at = notice.due ? Date.parse(notice.due.at) : Number.NaN;
  return Number.isNaN(at) ? undefined : at;
}

/** Gravest first; within a severity, the closest deadline first and those without one last; then as given. */
export function sortNotices(notices: readonly ActionNotice[]): ActionNotice[] {
  const keyed = notices.map((notice, index) => ({
    notice,
    index,
    rank: severityRank(notice.severity),
    deadline: deadlineOf(notice) ?? Number.POSITIVE_INFINITY,
  }));
  keyed.sort((a, b) => a.rank - b.rank || compareDeadlines(a.deadline, b.deadline) || a.index - b.index);
  return keyed.map((each) => each.notice);
}

// Two notices without a deadline tie: Infinity minus Infinity is NaN, which sort would not read as a tie.
function compareDeadlines(a: number, b: number): number {
  return a === b ? 0 : a - b;
}
