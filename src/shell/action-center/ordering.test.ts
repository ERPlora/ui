import { describe, expect, it } from 'vitest';

import { deadlineOf, severityRank, sortNotices } from './ordering';
import type { ActionNotice, NoticeDue, NoticeSeverity } from './types';

function notice(id: string, severity: NoticeSeverity, due?: NoticeDue): ActionNotice {
  return { id, severity, icon: 'ion:alert-circle-outline', label: id, title: id, due };
}

const ids = (list: readonly ActionNotice[]): string[] => list.map((each) => each.id);

describe('the order of the notices', () => {
  it('puts danger first, then warning, then info, whatever order the source gives', () => {
    const sorted = sortNotices([notice('i', 'info'), notice('w', 'warning'), notice('d', 'danger')]);
    expect(ids(sorted)).toEqual(['d', 'w', 'i']);
  });

  it('within a severity, the closest deadline first and those without one last', () => {
    const sorted = sortNotices([
      notice('none', 'warning'),
      notice('later', 'warning', { at: '2026-11-28T00:00:00Z' }),
      notice('sooner', 'warning', { at: '2026-11-20T00:00:00Z' }),
    ]);
    expect(ids(sorted)).toEqual(['sooner', 'later', 'none']);
  });

  it('compares deadlines as instants, whatever their offset', () => {
    const sorted = sortNotices([
      notice('utc', 'info', { at: '2026-11-20T09:30:00Z' }),
      notice('madrid', 'info', { at: '2026-11-20T10:00:00+01:00' }),
    ]);
    expect(ids(sorted)).toEqual(['madrid', 'utc']);
  });

  it('keeps the order of the source when severity and deadline tie', () => {
    const due = { at: '2026-11-20T00:00:00Z' };
    const sorted = sortNotices([
      notice('b', 'warning'),
      notice('a', 'warning'),
      notice('d', 'info', due),
      notice('c', 'info', due),
    ]);
    expect(ids(sorted)).toEqual(['b', 'a', 'd', 'c']);
  });

  it('leaves the list it gets as it was', () => {
    const list = [notice('i', 'info'), notice('d', 'danger')];
    sortNotices(list);
    expect(ids(list)).toEqual(['i', 'd']);
  });

  it('ranks the severities from the gravest', () => {
    expect([severityRank('danger'), severityRank('warning'), severityRank('info')]).toEqual([0, 1, 2]);
  });
});

describe('the deadline of a notice', () => {
  it('is the instant of its due date', () => {
    expect(deadlineOf(notice('a', 'info', { at: '2026-11-20T00:00:00Z' }))).toBe(Date.UTC(2026, 10, 20));
  });

  it('is undefined without a due date or with one that is not a date', () => {
    expect(deadlineOf(notice('a', 'info'))).toBeUndefined();
    expect(deadlineOf(notice('b', 'info', { at: 'soon' }))).toBeUndefined();
  });
});
