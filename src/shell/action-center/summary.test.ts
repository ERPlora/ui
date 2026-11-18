import { describe, expect, it } from 'vitest';

import { DEFAULT_COUNTDOWN_MS, dueProgress, summarize } from './summary';
import type { ActionNotice, NoticeDue, NoticeSeverity } from './types';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 17, 12);

function notice(id: string, severity: NoticeSeverity, extra: Partial<ActionNotice> = {}): ActionNotice {
  return { id, severity, icon: 'ion:alert-circle-outline', label: `${id} row`, title: `${id} title`, ...extra };
}

const iso = (time: number): string => new Date(time).toISOString();

describe('the summary for the bell', () => {
  it('adds up what each notice groups, counting 1 for the one that does not say', () => {
    const summary = summarize([notice('a', 'danger', { count: 3 }), notice('b', 'info')], NOW);
    expect(summary.total).toBe(4);
  });

  it('takes the severity and the hover text from the first of the order', () => {
    const first = notice('a', 'warning');
    const summary = summarize([first, notice('b', 'info')], NOW);
    expect(summary.topSeverity).toBe('warning');
    expect(summary.mostUrgent).toBe(first);
  });

  it('has nothing to show when nothing is pending', () => {
    expect(summarize([], NOW)).toEqual({
      total: 0,
      topSeverity: undefined,
      mostUrgent: undefined,
      dueProgress: undefined,
    });
  });

  it('measures the countdown of the most urgent notice that has a deadline', () => {
    const summary = summarize(
      [
        notice('no-deadline', 'danger'),
        notice('halfway', 'warning', { due: { at: iso(NOW + DAY), from: iso(NOW - DAY) } }),
        notice('just-started', 'info', { due: { at: iso(NOW + 2 * DAY), from: iso(NOW) } }),
      ],
      NOW,
    );
    expect(summary.dueProgress).toBe(0.5);
  });

  it('skips a deadline that is not a date', () => {
    const summary = summarize(
      [notice('broken', 'danger', { due: { at: 'soon' } }), notice('ok', 'info', { due: { at: iso(NOW), from: iso(NOW - DAY) } })],
      NOW,
    );
    expect(summary.dueProgress).toBe(1);
  });
});

describe('the progress of a countdown', () => {
  const due = (at: number, from?: number): NoticeDue => ({ at: iso(at), from: from === undefined ? undefined : iso(from) });

  it('goes from 0 when it starts to 1 at the deadline', () => {
    expect(dueProgress(due(NOW + 3 * DAY, NOW - DAY), NOW)).toBe(0.25);
    expect(dueProgress(due(NOW + 3 * DAY, NOW), NOW)).toBe(0);
    expect(dueProgress(due(NOW, NOW - DAY), NOW)).toBe(1);
  });

  it('stays at 0 before it starts and at 1 past the deadline', () => {
    expect(dueProgress(due(NOW + 3 * DAY, NOW + DAY), NOW)).toBe(0);
    expect(dueProgress(due(NOW - DAY, NOW - 3 * DAY), NOW)).toBe(1);
  });

  it('without a start, counts down over the last week before the deadline', () => {
    expect(DEFAULT_COUNTDOWN_MS).toBe(7 * DAY);
    expect(dueProgress(due(NOW + 3.5 * DAY), NOW)).toBe(0.5);
    expect(dueProgress(due(NOW + 10 * DAY), NOW)).toBe(0);
  });

  it('a start that is not a date counts as no start', () => {
    expect(dueProgress({ at: iso(NOW + 3.5 * DAY), from: 'yesterday' }, NOW)).toBe(0.5);
  });

  it('a start at or after the deadline is done once the deadline comes', () => {
    expect(dueProgress(due(NOW + DAY, NOW + DAY), NOW)).toBe(0);
    expect(dueProgress(due(NOW, NOW + DAY), NOW)).toBe(1);
  });
});
