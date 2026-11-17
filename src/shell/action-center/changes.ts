import type { ActionNotice } from './types';

/** How one result of the source differs from the one before, told by the ids alone. */
export interface ResultChanges {
  /** The notices that were not there before, in the order of the new result. */
  readonly added: readonly ActionNotice[];
  /** Whether a notice that was there now groups more things. */
  readonly raised: boolean;
  /** The notices that are no longer there, as they were last seen. */
  readonly removed: readonly ActionNotice[];
}

const weight = (notice: ActionNotice): number => notice.count ?? 1;

export function compareResults(previous: readonly ActionNotice[], next: readonly ActionNotice[]): ResultChanges {
  const before = new Map(previous.map((notice) => [notice.id, notice]));
  const after = new Set(next.map((notice) => notice.id));
  return {
    added: next.filter((notice) => !before.has(notice.id)),
    raised: next.some((notice) => {
      const old = before.get(notice.id);
      return old !== undefined && weight(notice) > weight(old);
    }),
    removed: previous.filter((notice) => !after.has(notice.id)),
  };
}

/** `next` followed by the notices of `previous` it lacks: a source that failed does not solve anything. */
export function keepMissing(previous: readonly ActionNotice[], next: readonly ActionNotice[]): readonly ActionNotice[] {
  const given = new Set(next.map((notice) => notice.id));
  return [...next, ...previous.filter((notice) => !given.has(notice.id))];
}
