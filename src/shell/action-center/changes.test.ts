import { describe, expect, it } from 'vitest';

import { compareResults, keepMissing } from './changes';
import type { ActionNotice } from './types';

function notice(id: string, extra: Partial<ActionNotice> = {}): ActionNotice {
  return { id, severity: 'warning', icon: 'ion:alert-circle-outline', label: id, title: id, ...extra };
}

const ids = (list: readonly ActionNotice[]): string[] => list.map((each) => each.id);

describe('what changed from one result to the next', () => {
  it('nothing when the next result has the same notices, even as new objects', () => {
    const changes = compareResults([notice('a', { count: 2 }), notice('b')], [notice('a', { count: 2 }), notice('b')]);
    expect(changes).toEqual({ added: [], raised: false, removed: [] });
  });

  it('the notices that came, in the order of the next result', () => {
    const changes = compareResults([notice('a')], [notice('c'), notice('a'), notice('b')]);
    expect(ids(changes.added)).toEqual(['c', 'b']);
  });

  it('the notices that left, as they were last seen', () => {
    const gone = notice('b', { label: 'last seen' });
    const changes = compareResults([notice('a'), gone], [notice('a')]);
    expect(changes.removed).toEqual([gone]);
  });

  it('a raised count of a notice that was already there', () => {
    expect(compareResults([notice('a', { count: 2 })], [notice('a', { count: 3 })]).raised).toBe(true);
    expect(compareResults([notice('a')], [notice('a', { count: 2 })]).raised).toBe(true);
  });

  it('not a lowered count, nor other changes of a notice that stays', () => {
    expect(compareResults([notice('a', { count: 3 })], [notice('a', { count: 2 })]).raised).toBe(false);
    expect(compareResults([notice('a', { chip: '3 days left' })], [notice('a', { chip: '2 days left' })])).toEqual({
      added: [],
      raised: false,
      removed: [],
    });
  });
});

describe('keeping what a failed source stopped giving', () => {
  it('adds the notices of the previous result that the next one lacks, after its own', () => {
    const kept = keepMissing([notice('a'), notice('b')], [notice('c'), notice('a')]);
    expect(ids(kept)).toEqual(['c', 'a', 'b']);
  });

  it('takes the next version of a notice that is in both', () => {
    const next = notice('a', { count: 5 });
    expect(keepMissing([notice('a')], [next])).toEqual([next]);
  });
});
