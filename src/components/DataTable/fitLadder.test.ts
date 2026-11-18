import { describe, expect, it } from 'vitest';

import { ladderLength, ladderPhases, ladderRung } from './fitLadder';

describe('ladderPhases: how many ways each step of the ladder is tried', () => {
  const name = { key: 'name', priority: 'high' as const };
  const status = { key: 'status' };

  it('one when every column fits its floor: nothing is ever cut', () => {
    expect(ladderPhases([name, status], { name: 0, status: 0 })).toBe(1);
    expect(ladderPhases([name, status], {})).toBe(1);
  });

  it('two when a column asks for more than its floor: whole, then cut', () => {
    expect(ladderPhases([name, status], { name: 0, status: 140 })).toBe(2);
  });

  it('three when the column asking for more is a name that keeps 10rem when cut: whole, cut, then the name at the floor', () => {
    expect(ladderPhases([name, status], { name: 209, status: 0 })).toBe(3);
    expect(ladderPhases([{ key: 'name', identity: { icon: () => '' } }], { name: 209 })).toBe(3);
  });

  it('a name with its own floor (`minWidth`) keeps it: two', () => {
    expect(ladderPhases([{ ...name, minWidth: '12rem' }, status], { name: 209 })).toBe(2);
  });
});

describe('ladderRung: each step of the ladder is first tried with every column whole', () => {
  it('without cutting, each rung is one step', () => {
    expect([0, 1, 2, 3].map((level) => ladderRung(level, 1))).toEqual([
      { base: 0, clipped: false },
      { base: 1, clipped: false },
      { base: 2, clipped: false },
      { base: 3, clipped: false },
    ]);
    expect(ladderLength(3, 1)).toBe(3);
  });

  it('cutting, every step is tried whole and then cut', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((level) => ladderRung(level, 2))).toEqual([
      { base: 0, clipped: false },
      { base: 0, clipped: true },
      { base: 1, clipped: false },
      { base: 1, clipped: true },
      { base: 2, clipped: false },
      { base: 2, clipped: true },
      { base: 3, clipped: false },
    ]);
    expect(ladderLength(3, 2)).toBe(7);
    expect(ladderLength(0, 2), 'a table with nothing to fold can still cut').toBe(1);
  });

  it('with a name that keeps 10rem, every step is tried whole, cut, and cut with the name at the floor', () => {
    expect([0, 1, 2, 3, 4, 5].map((level) => ladderRung(level, 3))).toEqual([
      { base: 0, clipped: false },
      { base: 0, clipped: true },
      { base: 0, clipped: 'tight' },
      { base: 1, clipped: false },
      { base: 1, clipped: true },
      { base: 1, clipped: 'tight' },
    ]);
    expect(ladderLength(2, 3)).toBe(8);
    expect(ladderLength(0, 3), 'a table with nothing to fold can still cut and squeeze the name').toBe(2);
  });
});
